import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import {
  EMBEDDING_GENERATOR,
  KNOWLEDGE_CHUNK_REPOSITORY,
  STRUCTURED_GRAPH_GENERATOR,
} from '../../application/knowledge.tokens';
import {
  InMemoryKnowledgeChunkRepository,
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
      },
    };

    const response = await request(app.getHttpServer())
      .post('/technical-queries')
      .send({ query: 'How does Netflix scale its API?' })
      .expect(201);

    expect(embeddings.prompts).toEqual(['How does Netflix scale its API?']);
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
