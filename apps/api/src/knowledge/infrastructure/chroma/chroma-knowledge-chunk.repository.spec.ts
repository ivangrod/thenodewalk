import type { Metadata } from 'chromadb';

import { KnowledgeChunkMother } from '../../domain/testing/knowledge.mother';
import type {
  ChromaCollectionGateway,
  ChromaCollectionProvider,
} from './chroma-collection.provider';
import { ChromaKnowledgeChunkRepository } from './chroma-knowledge-chunk.repository';

type UpsertParams = Parameters<ChromaCollectionGateway['upsert']>[0];
type QueryResponse = Awaited<ReturnType<ChromaCollectionGateway['query']>>;

class FakeChromaCollection implements ChromaCollectionGateway {
  upsertParams?: UpsertParams;
  queryResponse: QueryResponse = {
    ids: [[]],
    documents: [[]],
    embeddings: [[]],
    metadatas: [[]],
  };

  upsert(params: UpsertParams): Promise<void> {
    this.upsertParams = params;
    return Promise.resolve();
  }

  query(): Promise<QueryResponse> {
    return Promise.resolve(this.queryResponse);
  }
}

class FakeChromaCollectionProvider implements ChromaCollectionProvider {
  constructor(readonly fake: FakeChromaCollection) {}

  collection(): Promise<ChromaCollectionGateway> {
    return Promise.resolve(this.fake);
  }
}

describe('ChromaKnowledgeChunkRepository', () => {
  it('maps chunks and their metadata to the collection upsert payload', async () => {
    const fake = new FakeChromaCollection();
    const repository = new ChromaKnowledgeChunkRepository(new FakeChromaCollectionProvider(fake));
    const chunk = KnowledgeChunkMother.create({
      document: 'chunk text',
      embedding: [0.1, 0.2],
      blogName: 'Netflix Tech Blog',
      articleTitle: 'Scaling the edge',
      articleUrl: 'https://netflixtechblog.com/scaling-the-edge',
      publishedAt: '2026-01-01T00:00:00.000Z',
      chunkIndex: 3,
    });

    await repository.upsert([chunk]);

    expect(fake.upsertParams).toEqual({
      ids: [chunk.id],
      embeddings: [[0.1, 0.2]],
      documents: ['chunk text'],
      metadatas: [
        {
          blogName: 'Netflix Tech Blog',
          articleTitle: 'Scaling the edge',
          articleUrl: 'https://netflixtechblog.com/scaling-the-edge',
          publishedAt: '2026-01-01T00:00:00.000Z',
          chunkIndex: 3,
        },
      ],
    });
  });

  it('does not touch the collection when there are no chunks', async () => {
    const fake = new FakeChromaCollection();
    const repository = new ChromaKnowledgeChunkRepository(new FakeChromaCollectionProvider(fake));

    await repository.upsert([]);

    expect(fake.upsertParams).toBeUndefined();
  });

  it('maps a query result back into knowledge chunks', async () => {
    const fake = new FakeChromaCollection();
    const metadata: Metadata = {
      blogName: 'AWS Architecture Blog',
      articleTitle: 'Event-driven systems',
      articleUrl: 'https://aws.amazon.com/blogs/architecture/event-driven',
      publishedAt: '2026-02-02T00:00:00.000Z',
      chunkIndex: 0,
    };
    fake.queryResponse = {
      ids: [['ignored']],
      documents: [['retrieved chunk']],
      embeddings: [[[0.5, 0.6]]],
      metadatas: [[metadata]],
    };
    const repository = new ChromaKnowledgeChunkRepository(new FakeChromaCollectionProvider(fake));

    const results = await repository.search([0.5, 0.6], 5);

    expect(results).toHaveLength(1);
    expect(results[0]?.document).toBe('retrieved chunk');
    expect(results[0]?.metadata.articleUrl).toBe(
      'https://aws.amazon.com/blogs/architecture/event-driven',
    );
    expect(results[0]?.metadata.chunkIndex).toBe(0);
  });
});
