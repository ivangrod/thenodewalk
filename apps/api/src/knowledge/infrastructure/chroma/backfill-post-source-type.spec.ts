import type { Metadata } from 'chromadb';

import { KnowledgeChunkMetadataMother } from '../../domain/testing/knowledge.mother';
import {
  backfillPostSourceType,
  type ChromaMetadataMigrationCollection,
} from './backfill-post-source-type';

class InMemoryMetadataCollection implements ChromaMetadataMigrationCollection {
  readonly updates: Parameters<ChromaMetadataMigrationCollection['update']>[0][] = [];
  readonly offsets: number[] = [];

  constructor(readonly records: { id: string; metadata: Metadata | null }[]) {}

  get(
    params: Parameters<ChromaMetadataMigrationCollection['get']>[0],
  ): ReturnType<ChromaMetadataMigrationCollection['get']> {
    this.offsets.push(params.offset);
    const records = this.records.slice(params.offset, params.offset + params.limit);
    return Promise.resolve({
      ids: records.map(({ id }) => id),
      metadatas: records.map(({ metadata }) => metadata),
    });
  }

  update(params: Parameters<ChromaMetadataMigrationCollection['update']>[0]): Promise<void> {
    this.updates.push(params);
    for (const [index, id] of params.ids.entries()) {
      const record = this.records.find((record) => record.id === id);
      if (record) record.metadata = params.metadatas[index] ?? null;
    }
    return Promise.resolve();
  }
}

function legacyMetadata(): Metadata {
  const metadata = KnowledgeChunkMetadataMother.create();
  return {
    blogName: metadata.blogName,
    articleTitle: metadata.articleTitle,
    articleUrl: metadata.articleUrl,
    publishedAt: metadata.publishedAt,
    chunkIndex: metadata.chunkIndex,
  };
}

describe('backfillPostSourceType', () => {
  it('tags legacy posts preserving their ids and complete metadata', async () => {
    const metadata: Metadata = { ...legacyMetadata(), customField: 'keep me' };
    const collection = new InMemoryMetadataCollection([{ id: 'existing-chunk', metadata }]);

    expect(await backfillPostSourceType(collection)).toBe(1);

    expect(collection.updates).toEqual([
      {
        ids: ['existing-chunk'],
        metadatas: [{ ...metadata, sourceType: 'post', sourceId: metadata.articleUrl }],
      },
    ]);
  });

  it('skips tagged records and is idempotent', async () => {
    const typed = { ...KnowledgeChunkMetadataMother.create() };
    const collection = new InMemoryMetadataCollection([
      { id: 'legacy', metadata: legacyMetadata() },
      { id: 'typed', metadata: typed },
      { id: 'book', metadata: { sourceType: 'book', sourceId: 'book#0' } },
    ]);

    expect(await backfillPostSourceType(collection)).toBe(1);
    expect(await backfillPostSourceType(collection)).toBe(0);
    expect(collection.updates).toHaveLength(1);
    expect(collection.records[1]?.metadata).toEqual(typed);
    expect(collection.updates[0]?.ids).toEqual(['legacy']);
  });

  it('pages past fully tagged batches and bounds updates to 500 records', async () => {
    const collection = new InMemoryMetadataCollection(
      Array.from({ length: 1001 }, (_, index) => ({
        id: `chunk-${index}`,
        metadata: index < 500 ? { ...KnowledgeChunkMetadataMother.create() } : legacyMetadata(),
      })),
    );

    expect(await backfillPostSourceType(collection)).toBe(501);
    expect(collection.offsets).toEqual([0, 500, 1000]);
    expect(collection.updates.map(({ ids }) => ids.length)).toEqual([500, 1]);
  });

  it('does not update an empty collection', async () => {
    const collection = new InMemoryMetadataCollection([]);
    expect(await backfillPostSourceType(collection)).toBe(0);
    expect(collection.updates).toEqual([]);
  });

  it('rejects legacy metadata without an article URL', async () => {
    const collection = new InMemoryMetadataCollection([
      { id: 'broken', metadata: { blogName: 'Blog' } },
    ]);
    await expect(backfillPostSourceType(collection)).rejects.toThrow(
      'Cannot migrate chunk "broken": missing articleUrl',
    );
    expect(collection.updates).toEqual([]);
  });
});
