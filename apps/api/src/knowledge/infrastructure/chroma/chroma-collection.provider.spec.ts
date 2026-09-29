import type { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';

import { ChromaClientCollectionProvider } from './chroma-collection.provider';
import { PrecomputedEmbeddingFunction } from './precomputed-embedding-function';

type GetOrCreateCollectionParams = Parameters<ChromaClient['getOrCreateCollection']>[0];

const COLLECTION_NAME = 'knowledge_chunks';

class FakeChromaClient implements Pick<ChromaClient, 'getOrCreateCollection'> {
  readonly getOrCreateCollectionCalls: GetOrCreateCollectionParams[] = [];

  getOrCreateCollection(params: GetOrCreateCollectionParams): Promise<Collection> {
    this.getOrCreateCollectionCalls.push(params);
    // Only the members used by the provider are needed for these tests.
    const collection = { upsert: jest.fn(), query: jest.fn() };
    return Promise.resolve(collection as unknown as Collection);
  }

  embeddingFunctionUsed(): EmbeddingFunction | null | undefined {
    return this.getOrCreateCollectionCalls[0]?.embeddingFunction;
  }
}

describe('ChromaClientCollectionProvider', () => {
  it("creates the collection without Chroma's default embedding function", async () => {
    const client = new FakeChromaClient();
    const provider = new ChromaClientCollectionProvider(client, COLLECTION_NAME);

    await provider.collection();

    expect(client.getOrCreateCollectionCalls).toEqual([
      { name: COLLECTION_NAME, embeddingFunction: expect.any(PrecomputedEmbeddingFunction) },
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
});
