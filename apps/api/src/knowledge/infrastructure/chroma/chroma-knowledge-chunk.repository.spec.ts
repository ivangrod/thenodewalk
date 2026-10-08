import type { Metadata } from 'chromadb';

import { KnowledgeChunkMother } from '../../domain/testing/knowledge.mother';
import type {
  ChromaCollectionGateway,
  ChromaCollectionProvider,
} from './chroma-collection.provider';
import {
  CHROMA_UPSERT_BATCH_SIZE,
  ChromaKnowledgeChunkRepository,
} from './chroma-knowledge-chunk.repository';

type UpsertParams = Parameters<ChromaCollectionGateway['upsert']>[0];
type QueryResponse = Awaited<ReturnType<ChromaCollectionGateway['query']>>;

class FakeChromaCollection implements ChromaCollectionGateway {
  readonly upsertCalls: UpsertParams[] = [];
  queryResponse: QueryResponse = {
    ids: [[]],
    documents: [[]],
    embeddings: [[]],
    metadatas: [[]],
    distances: [[]],
  };

  get upsertParams(): UpsertParams | undefined {
    return this.upsertCalls.at(-1);
  }

  upsert(params: UpsertParams): Promise<void> {
    this.upsertCalls.push(params);
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
          sourceType: 'post',
          sourceId: 'https://netflixtechblog.com/scaling-the-edge',
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

  it('splits large upserts into batches that keep every chunk in order', async () => {
    const fake = new FakeChromaCollection();
    const repository = new ChromaKnowledgeChunkRepository(
      new FakeChromaCollectionProvider(fake),
      2,
    );
    const chunks = Array.from({ length: 5 }, (_, chunkIndex) =>
      KnowledgeChunkMother.create({ articleUrl: 'https://blog.test/long', chunkIndex }),
    );

    await repository.upsert(chunks);

    expect(fake.upsertCalls.map((call) => call.ids.length)).toEqual([2, 2, 1]);
    expect(fake.upsertCalls.flatMap((call) => call.ids)).toEqual(chunks.map((chunk) => chunk.id));
  });

  it('keeps the default batch below the ChromaDB max batch size', () => {
    expect(CHROMA_UPSERT_BATCH_SIZE).toBeLessThanOrEqual(5461);
  });

  it('maps a legacy chunk without sourceType into a scored post chunk', async () => {
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
      distances: [[0]],
    };
    const repository = new ChromaKnowledgeChunkRepository(new FakeChromaCollectionProvider(fake));

    const results = await repository.search([0.5, 0.6], 5);

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.document).toBe('retrieved chunk');
    expect(results[0]?.chunk.metadata.articleUrl).toBe(
      'https://aws.amazon.com/blogs/architecture/event-driven',
    );
    expect(results[0]?.chunk.metadata.chunkIndex).toBe(0);
    expect(results[0]?.chunk.metadata.sourceType).toBe('post');
    expect(results[0]?.chunk.metadata.sourceId).toBe(metadata.articleUrl);
    // distance 0 -> maximum similarity score of 1.
    expect(results[0]?.score).toBe(1);
  });

  it('preserves sourceId from typed post metadata', async () => {
    const fake = new FakeChromaCollection();
    const chunk = KnowledgeChunkMother.create({ sourceId: 'post-identity' });
    fake.queryResponse = {
      ids: [[chunk.id]],
      documents: [[chunk.document]],
      embeddings: [[chunk.embedding]],
      metadatas: [[{ ...chunk.metadata }]],
      distances: [[0]],
    };
    const repository = new ChromaKnowledgeChunkRepository(new FakeChromaCollectionProvider(fake));

    const results = await repository.search(chunk.embedding, 1);

    expect(results[0]?.chunk.metadata).toEqual(chunk.metadata);
  });

  it('scores every match with the cosine similarity behind its cosine distance', async () => {
    const fake = new FakeChromaCollection();
    const metadata = (articleUrl: string): Metadata => ({
      blogName: 'Blog',
      articleTitle: 'Title',
      articleUrl,
      publishedAt: '',
      chunkIndex: 0,
    });
    fake.queryResponse = {
      ids: [['close', 'unrelated', 'opposite']],
      documents: [['close', 'unrelated', 'opposite']],
      embeddings: null,
      metadatas: [
        [metadata('https://a.test'), metadata('https://b.test'), metadata('https://c.test')],
      ],
      distances: [[0.25, 1, 2]],
    };
    const repository = new ChromaKnowledgeChunkRepository(new FakeChromaCollectionProvider(fake));

    const results = await repository.search([1, 0], 3);

    expect(results.map((result) => result.score)).toEqual([0.75, 0, -1]);
  });
});
