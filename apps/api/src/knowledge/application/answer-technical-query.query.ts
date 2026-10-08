import { Inject, Injectable, Logger } from '@nestjs/common';

import type {
  KnowledgeGraph,
  KnowledgeNodeSource,
  TechnicalQueryResponse,
} from '@thenodewalk/contracts';

import type { EmbeddingGenerator } from '../domain/embedding-generator';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import type {
  GeneratedGraph,
  KnowledgeGraph as KnowledgeGraphModel,
} from '../domain/knowledge-graph';
import { assignUniqueSources, EMPTY_GRAPH } from '../domain/knowledge-graph';
import {
  limitGraphDepth,
  MAX_GRAPH_DEPTH,
  resolveCentralNodeId,
} from '../domain/knowledge-graph-focus';
import type { StructuredGraphGenerator } from '../domain/structured-graph-generator';
import {
  EMBEDDING_GENERATOR,
  KNOWLEDGE_CHUNK_REPOSITORY,
  STRUCTURED_GRAPH_GENERATOR,
} from './knowledge.tokens';

/** Number of most relevant chunks retrieved as context for a technical query. */
export const TECHNICAL_QUERY_TOP_K = 5;

const NO_CONTEXT_SUMMARY =
  'No indexed sources match this question yet. Ingest more books or engineering blogs and try again.';
const GENERATION_FAILURE_SUMMARY =
  'The answer could not be generated from the retrieved sources. Please try again.';

/**
 * Read-only query (CQRS) that answers a technical question with a summary and a
 * structured knowledge graph. It embeds the question once, retrieves the Top-K
 * chunks and asks the {@link StructuredGraphGenerator} to reason over that
 * traceable context. The generated graph is then constrained so each node can
 * only link a retrieved post, each post is linked to at most one node, and every
 * node is at most {@link MAX_GRAPH_DEPTH} levels away from the central node (the
 * node holding the main idea of the most relevant post).
 * No state is mutated and no domain events are emitted.
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
    const embedding = await this.embeddings.embedQuery(query);
    const matches = await this.repository.search(embedding, TECHNICAL_QUERY_TOP_K);

    const [mainMatch] = matches;
    if (!mainMatch) {
      return this.toResponse({ summary: NO_CONTEXT_SUMMARY, graph: EMPTY_GRAPH }, new Map());
    }

    try {
      const generated = await this.graphGenerator.generate(query, matches);
      const sources = new Map<string, KnowledgeNodeSource>(
        matches.map(({ chunk }) => [
          chunk.metadata.sourceId,
          chunk.metadata.sourceType === 'post'
            ? { kind: 'post', url: chunk.metadata.articleUrl }
            : {
                kind: 'book',
                bookTitle: chunk.metadata.bookTitle,
                sectionTitle: chunk.metadata.sectionTitle || null,
                pageStart: chunk.metadata.pageStart ?? null,
              },
        ]),
      );
      const sourced = assignUniqueSources(generated.graph, new Set(sources.keys()));
      const centred: KnowledgeGraphModel = {
        ...sourced,
        centralNodeId: resolveCentralNodeId(sourced, mainMatch.chunk.metadata.sourceId),
      };
      return this.toResponse(
        {
          summary: generated.summary,
          graph: limitGraphDepth(centred, MAX_GRAPH_DEPTH),
        },
        sources,
      );
    } catch (error) {
      this.logger.warn(
        `Structured graph generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.toResponse(
        { summary: GENERATION_FAILURE_SUMMARY, graph: EMPTY_GRAPH },
        new Map(),
      );
    }
  }

  private toResponse(
    generated: GeneratedGraph,
    sources: ReadonlyMap<string, KnowledgeNodeSource>,
  ): TechnicalQueryResponse {
    return {
      summary: generated.summary,
      graph: this.toGraph(generated.graph, sources),
    };
  }

  private toGraph(
    graph: GeneratedGraph['graph'],
    sources: ReadonlyMap<string, KnowledgeNodeSource>,
  ): KnowledgeGraph {
    return {
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        source: node.sourceId === null ? null : (sources.get(node.sourceId) ?? null),
      })),
      edges: graph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        relationship: edge.relationship,
      })),
      centralNodeId: graph.centralNodeId,
    };
  }
}
