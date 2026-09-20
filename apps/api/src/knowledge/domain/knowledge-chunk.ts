import { createHash } from 'node:crypto';

/**
 * Metadata persisted alongside every chunk in the vector store. Mirrors the
 * ChromaDB `knowledge_chunks` collection metadata schema.
 */
export interface KnowledgeChunkMetadata {
  blogName: string;
  articleTitle: string;
  articleUrl: string;
  publishedAt: string;
  chunkIndex: number;
}

/**
 * A piece of an article ready to be indexed: its text, the embedding vector and
 * the metadata that links it back to the original source.
 */
export interface KnowledgeChunkPrimitives {
  document: string;
  embedding: number[];
  metadata: KnowledgeChunkMetadata;
}

export interface KnowledgeChunk extends KnowledgeChunkPrimitives {
  id: string;
}

/**
 * Deterministic identifier for a chunk: `sha256(articleUrl + '#' + chunkIndex)`.
 * Re-ingesting the same article yields the same ids, making the upsert
 * idempotent (the vector store overwrites instead of duplicating).
 */
export function knowledgeChunkId(articleUrl: string, chunkIndex: number): string {
  return createHash('sha256').update(`${articleUrl}#${chunkIndex}`).digest('hex');
}

export function createKnowledgeChunk(primitives: KnowledgeChunkPrimitives): KnowledgeChunk {
  return {
    id: knowledgeChunkId(primitives.metadata.articleUrl, primitives.metadata.chunkIndex),
    ...primitives,
  };
}
