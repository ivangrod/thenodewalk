import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import {
  EMBEDDING_GENERATOR,
  FEED_LAST_PUBLICATION_DATE_REPOSITORY,
  KNOWLEDGE_CHUNK_REPOSITORY,
  STRUCTURED_GRAPH_GENERATOR,
} from '../../application/knowledge.tokens';
import {
  InMemoryKnowledgeChunkRepository,
  InMemoryFeedLastPublicationDateRepository,
  StubEmbeddingGenerator,
  StubStructuredGraphGenerator,
} from '../../application/testing/knowledge-test-doubles';
import { KnowledgeChunkMother } from '../../domain/testing/knowledge.mother';
import { KnowledgeModule } from '../knowledge.module';

describe('POST /technical-queries (integration)', () => {
  let app: INestApplication;
  let repository: InMemoryKnowledgeChunkRepository;
  let generator: StubStructuredGraphGenerator;
  let embeddings: StubEmbeddingGenerator;

  beforeAll(async () => {
    repository = new InMemoryKnowledgeChunkRepository();
    generator = new StubStructuredGraphGenerator();
    embeddings = new StubEmbeddingGenerator([0.1, 0.2, 0.3]);

    const moduleRef = await Test.createTestingModule({ imports: [KnowledgeModule] })
      .overrideProvider(FEED_LAST_PUBLICATION_DATE_REPOSITORY)
      .useValue(new InMemoryFeedLastPublicationDateRepository())
      .overrideProvider(EMBEDDING_GENERATOR)
      .useValue(embeddings)
      .overrideProvider(KNOWLEDGE_CHUNK_REPOSITORY)
      .useValue(repository)
      .overrideProvider(STRUCTURED_GRAPH_GENERATOR)
      .useValue(generator)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retrieves chunks and returns a validated summary + graph preserving source URLs', async () => {
    repository.matches = [
      {
        chunk: KnowledgeChunkMother.create({ articleUrl: 'https://netflixtechblog.com/gateway' }),
        score: 0.92,
      },
    ];
    generator.result = {
      summary: 'Netflix relies on a federated API gateway.',
      graph: {
        nodes: [
          {
            id: 'gateway',
            label: 'API Gateway',
            type: 'concept',
            sourceUrl: 'https://netflixtechblog.com/gateway',
          },
        ],
        edges: [],
        centralNodeId: 'gateway',
      },
    };

    const response = await request(app.getHttpServer())
      .post('/technical-queries')
      .send({ query: 'How does Netflix scale its API?' })
      .expect(201);

    expect(embeddings.queries).toEqual(['How does Netflix scale its API?']);
    expect(repository.searchCalls).toHaveLength(1);
    expect(generator.calls).toHaveLength(1);
    expect(response.body).toEqual({
      summary: 'Netflix relies on a federated API gateway.',
      graph: {
        nodes: [
          {
            id: 'gateway',
            label: 'API Gateway',
            type: 'concept',
            sourceUrl: 'https://netflixtechblog.com/gateway',
          },
        ],
        edges: [],
        centralNodeId: 'gateway',
      },
    });
  });

  it('links each source to at most one node', async () => {
    const sourceUrl = 'https://netflixtechblog.com/gateway';
    repository.matches = [
      { chunk: KnowledgeChunkMother.create({ articleUrl: sourceUrl }), score: 0.9 },
    ];
    generator.result = {
      summary: 'Netflix routes traffic through a gateway.',
      graph: {
        nodes: [
          { id: 'gateway', label: 'API Gateway', type: 'concept', sourceUrl },
          { id: 'routing', label: 'Routing', type: 'concept', sourceUrl },
        ],
        edges: [{ source: 'gateway', target: 'routing', relationship: 'performs' }],
        centralNodeId: 'gateway',
      },
    };

    const response = await request(app.getHttpServer())
      .post('/technical-queries')
      .send({ query: 'How does Netflix route traffic?' })
      .expect(201);

    expect(response.body).toEqual({
      summary: 'Netflix routes traffic through a gateway.',
      graph: {
        nodes: [
          { id: 'gateway', label: 'API Gateway', type: 'concept', sourceUrl },
          { id: 'routing', label: 'Routing', type: 'concept', sourceUrl: null },
        ],
        edges: [{ source: 'gateway', target: 'routing', relationship: 'performs' }],
        centralNodeId: 'gateway',
      },
    });
  });

  it('rejects an empty query body with 400', async () => {
    await request(app.getHttpServer()).post('/technical-queries').send({ query: '' }).expect(400);
  });

  it('rejects a body with unknown properties with 400', async () => {
    await request(app.getHttpServer())
      .post('/technical-queries')
      .send({ query: 'valid', injected: true })
      .expect(400);
  });
});
