import type {
  ChromaClient,
  Collection,
  CollectionConfiguration,
  EmbeddingFunction,
} from 'chromadb';

import {
  ChromaClientCollectionProvider,
  IncompatibleKnowledgeCollectionError,
} from './chroma-collection.provider';
import { PrecomputedEmbeddingFunction } from './precomputed-embedding-function';

type GetOrCreateCollectionParams = Parameters<ChromaClient['getOrCreateCollection']>[0];

const COLLECTION_NAME = 'knowledge_chunks';

class FakeChromaClient implements Pick<ChromaClient, 'getOrCreateCollection'> {
  readonly getOrCreateCollectionCalls: GetOrCreateCollectionParams[] = [];

  /**
   * @param existingConfiguration configuration of a collection that already exists
   * on the server, which ChromaDB returns instead of the requested one.
   */
  constructor(private readonly existingConfiguration?: CollectionConfiguration) {}

  getOrCreateCollection(params: GetOrCreateCollectionParams): Promise<Collection> {
    this.getOrCreateCollectionCalls.push(params);
    // Only the members used by the provider are needed for these tests.
    const collection = {
      configuration: this.existingConfiguration ?? params.configuration ?? {},
      upsert: jest.fn(),
      query: jest.fn(),
    };
    return Promise.resolve(collection as unknown as Collection);
  }

  embeddingFunctionUsed(): EmbeddingFunction | null | undefined {
    return this.getOrCreateCollectionCalls[0]?.embeddingFunction;
  }
}

describe('ChromaClientCollectionProvider', () => {
  it("creates a cosine collection without Chroma's default embedding function", async () => {
    const client = new FakeChromaClient();
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    await provider.collection();

    expect(client.getOrCreateCollectionCalls).toEqual([
      {
        name: COLLECTION_NAME,
        embeddingFunction: expect.any(PrecomputedEmbeddingFunction),
        configuration: { hnsw: { space: 'cosine' } },
      },
    ]);
  });

  it('reuses the same collection handle across calls', async () => {
    const client = new FakeChromaClient();
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    const first = await provider.collection();
    const second = await provider.collection();

    expect(second).toBe(first);
    expect(client.getOrCreateCollectionCalls).toHaveLength(1);
  });

  it('fails with a clear error if Chroma tries to embed raw text', async () => {
    const client = new FakeChromaClient();
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    await provider.collection();

    await expect(client.embeddingFunctionUsed()?.generate(['raw text'])).rejects.toThrow(
      'only accepts precomputed embeddings generated through the EmbeddingGenerator port',
    );
  });

  it('accepts an existing cosine collection', async () => {
    const client = new FakeChromaClient({ hnsw: { space: 'cosine', ef_search: 100 } });
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    await expect(provider.collection()).resolves.toBeDefined();
  });

  it('rejects an existing collection created with another distance', async () => {
    const client = new FakeChromaClient({ hnsw: { space: 'l2' } });
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    const collection = provider.collection();

    await expect(collection).rejects.toBeInstanceOf(IncompatibleKnowledgeCollectionError);
    await expect(collection).rejects.toThrow(
      'Chroma collection "knowledge_chunks" uses the "l2" distance',
    );
    await expect(collection).rejects.toThrow('ingest --full');
  });

  it("treats an existing collection without a declared distance as Chroma's default l2", async () => {
    const client = new FakeChromaClient({ hnsw: null, spann: null });
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    await expect(provider.collection()).rejects.toThrow('uses the "l2" distance');
  });
});
