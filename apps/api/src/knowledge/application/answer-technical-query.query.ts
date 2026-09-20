import { Inject, Injectable } from '@nestjs/common';

import type { RetrievedChunkDto, TechnicalQueryResponse } from '@thenodewalk/contracts';

import type { EmbeddingGenerator } from '../domain/embedding-generator';
import type {
  KnowledgeChunkRepository,
  KnowledgeSearchMatch,
} from '../domain/knowledge-chunk-repository';
import { EMBEDDING_GENERATOR, KNOWLEDGE_CHUNK_REPOSITORY } from './knowledge.tokens';

/** Number of most relevant chunks retrieved for a technical query. */
export const TECHNICAL_QUERY_TOP_K = 5;

/**
 * Read-only query (CQRS) that answers a technical question with the most
 * relevant indexed chunks. It embeds the question once with the same model used
 * during ingestion and retrieves the Top-K matches from the vector store. No
 * state is mutated and no domain events are emitted. The LLM graph is layered on
 * top of this retrieval in Phase 4.
 */
@Injectable()
export class AnswerTechnicalQueryQuery {
  constructor(
    @Inject(EMBEDDING_GENERATOR)
    private readonly embeddings: EmbeddingGenerator,
    @Inject(KNOWLEDGE_CHUNK_REPOSITORY)
    private readonly repository: KnowledgeChunkRepository,
  ) {}

  async execute(query: string): Promise<TechnicalQueryResponse> {
    const embedding = await this.embeddings.generate(query);
    const matches = await this.repository.search(embedding, TECHNICAL_QUERY_TOP_K);

    return { chunks: matches.map((match) => this.toDto(match)) };
  }

  private toDto(match: KnowledgeSearchMatch): RetrievedChunkDto {
    return {
      document: match.chunk.document,
      articleTitle: match.chunk.metadata.articleTitle,
      articleUrl: match.chunk.metadata.articleUrl,
      blogName: match.chunk.metadata.blogName,
      score: match.score,
    };
  }
}
