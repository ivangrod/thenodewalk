import type { Metadata } from 'chromadb';

export interface ChromaMetadataMigrationCollection {
  get(params: { limit: number; offset: number; include: ['metadatas'] }): Promise<{
    ids: string[];
    metadatas: (Metadata | null)[];
  }>;
  update(params: { ids: string[]; metadatas: Metadata[] }): Promise<void>;
}

/** Updates metadata only: stored documents, vectors and deterministic ids are preserved. */
export async function backfillPostSourceType(
  collection: ChromaMetadataMigrationCollection,
): Promise<number> {
  const batchSize = 500;
  let updated = 0;
  for (let offset = 0; ; offset += batchSize) {
    const page = await collection.get({ limit: batchSize, offset, include: ['metadatas'] });
    const ids: string[] = [];
    const metadatas: Metadata[] = [];
    for (const [index, id] of page.ids.entries()) {
      const metadata = page.metadatas[index];
      if (!metadata || metadata.sourceType !== undefined) continue;
      if (typeof metadata.articleUrl !== 'string' || metadata.articleUrl.trim() === '') {
        throw new Error(`Cannot migrate chunk "${id}": missing articleUrl`);
      }
      ids.push(id);
      metadatas.push({ ...metadata, sourceType: 'post', sourceId: metadata.articleUrl });
    }
    if (ids.length > 0) {
      await collection.update({ ids, metadatas });
      updated += ids.length;
    }
    if (page.ids.length < batchSize) return updated;
  }
}
