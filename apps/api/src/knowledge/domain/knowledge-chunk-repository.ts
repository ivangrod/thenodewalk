import type { KnowledgeChunk } from './knowledge-chunk';

/**
 * Port for persisting and retrieving knowledge chunks from the vector store.
 */
export interface KnowledgeChunkRepository {
  /** Idempotently indexes the given chunks (same id overwrites, never duplicates). */
  upsert(chunks: KnowledgeChunk[]): Promise<void>;
  /** Returns the chunks whose embeddings are closest to the query embedding. */
  search(embedding: number[], limit: number): Promise<KnowledgeChunk[]>;
}
