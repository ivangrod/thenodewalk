import type { KnowledgeChunk, KnowledgeSourceType } from './knowledge-chunk';

export interface KnowledgeSearchFilter {
  sourceType: KnowledgeSourceType;
}

/**
 * A chunk retrieved from the vector store together with its relevance score: the
 * cosine similarity to the query embedding, in `[-1, 1]` (higher is closer).
 */
export interface KnowledgeSearchMatch {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Port for persisting and retrieving knowledge chunks from the vector store.
 */
export interface KnowledgeChunkRepository {
  /** Idempotently indexes the given chunks (same id overwrites, never duplicates). */
  upsert(chunks: KnowledgeChunk[]): Promise<void>;
  /** Returns the matches whose embeddings are closest to the query embedding. */
  search(
    embedding: number[],
    limit: number,
    filter?: KnowledgeSearchFilter,
  ): Promise<KnowledgeSearchMatch[]>;
}
