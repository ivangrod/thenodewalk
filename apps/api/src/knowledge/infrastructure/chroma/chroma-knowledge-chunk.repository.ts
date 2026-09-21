import type { Metadata } from 'chromadb';

import { createKnowledgeChunk } from '../../domain/knowledge-chunk';
import type { KnowledgeChunk, KnowledgeChunkMetadata } from '../../domain/knowledge-chunk';
import type {
  KnowledgeChunkRepository,
  KnowledgeSearchMatch,
} from '../../domain/knowledge-chunk-repository';
import type { ChromaCollectionProvider } from './chroma-collection.provider';

export const KNOWLEDGE_CHUNKS_COLLECTION = 'knowledge_chunks';

/**
 * ChromaDB adapter for {@link KnowledgeChunkRepository}. Maps domain chunks to the
 * collection payload and back. Upserts are idempotent thanks to the deterministic
 * chunk ids.
 */
export class ChromaKnowledgeChunkRepository implements KnowledgeChunkRepository {
  constructor(private readonly provider: ChromaCollectionProvider) {}

  async upsert(chunks: KnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const collection = await this.provider.collection();
    await collection.upsert({
      ids: chunks.map((chunk) => chunk.id),
      embeddings: chunks.map((chunk) => chunk.embedding),
      documents: chunks.map((chunk) => chunk.document),
      metadatas: chunks.map((chunk) => this.toMetadata(chunk.metadata)),
    });
  }

  async search(embedding: number[], limit: number): Promise<KnowledgeSearchMatch[]> {
    const collection = await this.provider.collection();
    const result = await collection.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      include: ['documents', 'metadatas', 'embeddings', 'distances'],
    });

    const documents = result.documents[0] ?? [];
    const metadatas = result.metadatas[0] ?? [];
    const embeddings = result.embeddings?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];

    return documents.flatMap((document, index) => {
      const metadata = metadatas[index];
      if (document === null || metadata === undefined || metadata === null) {
        return [];
      }

      const chunk = createKnowledgeChunk({
        document,
        embedding: embeddings[index] ?? [],
        metadata: this.fromMetadata(metadata),
      });

      return [{ chunk, score: this.toScore(distances[index]) }];
    });
  }

  /**
   * Converts a distance (lower is closer) into a similarity score in `(0, 1]`
   * (higher is more relevant).
   */
  private toScore(distance: number | null | undefined): number {
    if (distance === null || distance === undefined) {
      return 0;
    }
    return 1 / (1 + Math.max(0, distance));
  }

  private toMetadata(metadata: KnowledgeChunkMetadata): Metadata {
    return {
      blogName: metadata.blogName,
      articleTitle: metadata.articleTitle,
      articleUrl: metadata.articleUrl,
      publishedAt: metadata.publishedAt,
      chunkIndex: metadata.chunkIndex,
    };
  }

  private fromMetadata(metadata: Metadata): KnowledgeChunkMetadata {
    return {
      blogName: String(metadata.blogName ?? ''),
      articleTitle: String(metadata.articleTitle ?? ''),
      articleUrl: String(metadata.articleUrl ?? ''),
      publishedAt: String(metadata.publishedAt ?? ''),
      chunkIndex: Number(metadata.chunkIndex ?? 0),
    };
  }
}
