import { Inject, Injectable, Logger } from '@nestjs/common';

import type { KnowledgeGraph, TechnicalQueryResponse } from '@thenodewalk/contracts';

import type { EmbeddingGenerator } from '../domain/embedding-generator';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import type { GeneratedGraph } from '../domain/knowledge-graph';
import { EMPTY_GRAPH } from '../domain/knowledge-graph';
import type { StructuredGraphGenerator } from '../domain/structured-graph-generator';
import {
  EMBEDDING_GENERATOR,
  KNOWLEDGE_CHUNK_REPOSITORY,
  STRUCTURED_GRAPH_GENERATOR,
} from './knowledge.tokens';

/** Number of most relevant chunks retrieved as context for a technical query. */
export const TECHNICAL_QUERY_TOP_K = 5;

const NO_CONTEXT_SUMMARY =
  'No indexed sources match this question yet. Ingest more engineering blogs and try again.';
const GENERATION_FAILURE_SUMMARY =
  'The answer could not be generated from the retrieved sources. Please try again.';

/**
 * Read-only query (CQRS) that answers a technical question with a summary and a
 * structured knowledge graph. It embeds the question once, retrieves the Top-K
 * chunks and asks the {@link StructuredGraphGenerator} to reason over that
 * traceable context. No state is mutated and no domain events are emitted.
 */
@Injectable()
export class AnswerTechnicalQueryQuery {
  private readonly logger = new Logger(AnswerTechnicalQueryQuery.name);

  constructor(
    @Inject(EMBEDDING_GENERATOR)
    private readonly embeddings: EmbeddingGenerator,
    @Inject(KNOWLEDGE_CHUNK_REPOSITORY)
    private readonly repository: KnowledgeChunkRepository,
    @Inject(STRUCTURED_GRAPH_GENERATOR)
    private readonly graphGenerator: StructuredGraphGenerator,
  ) {}

  async execute(query: string): Promise<TechnicalQueryResponse> {
    const embedding = await this.embeddings.generate(query);
    const matches = await this.repository.search(embedding, TECHNICAL_QUERY_TOP_K);

    if (matches.length === 0) {
      return { summary: NO_CONTEXT_SUMMARY, graph: EMPTY_GRAPH };
    }

    try {
      const generated = await this.graphGenerator.generate(query, matches);
      return this.toResponse(generated);
    } catch (error) {
      this.logger.warn(
        `Structured graph generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { summary: GENERATION_FAILURE_SUMMARY, graph: EMPTY_GRAPH };
    }
  }

  private toResponse(generated: GeneratedGraph): TechnicalQueryResponse {
    return {
      summary: generated.summary,
      graph: this.toGraph(generated.graph),
    };
  }

  private toGraph(graph: GeneratedGraph['graph']): KnowledgeGraph {
    return {
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        sourceUrl: node.sourceUrl,
      })),
      edges: graph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        relationship: edge.relationship,
      })),
    };
  }
}
