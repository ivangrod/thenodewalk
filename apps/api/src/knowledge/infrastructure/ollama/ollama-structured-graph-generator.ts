import { Ollama } from 'ollama';

import type { KnowledgeSearchMatch } from '../../domain/knowledge-chunk-repository';
import type {
  GeneratedGraph,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from '../../domain/knowledge-graph';
import { MAX_GRAPH_DEPTH } from '../../domain/knowledge-graph-focus';
import type { StructuredGraphGenerator } from '../../domain/structured-graph-generator';

/** Raised when the LLM output cannot be parsed into a valid graph. */
export class InvalidStructuredGraphError extends Error {
  constructor(reason: string) {
    super(`Invalid structured graph output: ${reason}`);
    this.name = 'InvalidStructuredGraphError';
  }
}

/** Versioned system prompt. Bump the version when the contract or rules change. */
export const STRUCTURED_GRAPH_SYSTEM_PROMPT_VERSION = 'v4';

export const STRUCTURED_GRAPH_SYSTEM_PROMPT = `You are a senior software architect. Using ONLY the provided sources, answer the question as an interactive knowledge graph.
Respond with a single JSON object and nothing else, matching exactly this schema:
{
  "summary": string,               // concise natural-language answer
  "graph": {
    "nodes": [                     // key concepts
      { "id": string, "label": string, "type": "concept", "sourceUrl": string | null }
    ],
    "edges": [                     // semantic relationships between node ids
      { "source": string, "target": string, "relationship": string }
    ],
    "centralNodeId": string        // id of the node holding the main idea
  }
}
Rules:
- A node "sourceUrl" MUST be one of the provided source URLs, or null.
- Use null as "sourceUrl" when no provided source supports the concept.
- Each source URL can be linked to at most one node; use null as "sourceUrl" for the other nodes supported by the same source.
- Every edge "source" and "target" MUST reference an existing node "id".
- "centralNodeId" MUST be the id of the node holding the main idea of the most relevant source (Source 1).
- Every node MUST be reachable from the central node through at most ${MAX_GRAPH_DEPTH} edges.
- "type" is always the literal "concept".
- Do not invent facts that are not supported by the sources.
- Output valid JSON only, no markdown fences, no comments.`;

/** Subset of the Ollama client used to generate structured graphs. */
export interface OllamaChatClient {
  chat(request: {
    model: string;
    messages: { role: string; content: string }[];
    format?: string | object;
    options?: { temperature?: number };
  }): Promise<{ message: { content: string } }>;
}

/**
 * Forces a local Ollama chat model to emit a strictly structured knowledge graph
 * as JSON, then validates and normalizes it into the domain model.
 */
export class OllamaStructuredGraphGenerator implements StructuredGraphGenerator {
  constructor(
    private readonly client: OllamaChatClient,
    private readonly model: string,
  ) {}

  async generate(query: string, context: KnowledgeSearchMatch[]): Promise<GeneratedGraph> {
    const response = await this.client.chat({
      model: this.model,
      format: 'json',
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: STRUCTURED_GRAPH_SYSTEM_PROMPT },
        { role: 'user', content: this.buildUserPrompt(query, context) },
      ],
    });

    return parseGeneratedGraph(response.message.content);
  }

  private buildUserPrompt(query: string, context: KnowledgeSearchMatch[]): string {
    const sources = context
      .map(
        (match, index) =>
          `Source ${index + 1} (sourceUrl: ${match.chunk.metadata.articleUrl}):\n${match.chunk.document}`,
      )
      .join('\n\n');

    return `Question: ${query}\n\nSources:\n${sources}`;
  }
}

/**
 * Parses and validates the raw LLM JSON into a {@link GeneratedGraph}. Throws
 * {@link InvalidStructuredGraphError} when the top-level shape is wrong, and
 * repairs the graph by dropping malformed nodes/edges and edges that reference
 * unknown nodes. Nodes without a usable source are kept with `sourceUrl: null`,
 * and a missing or blank central node is returned as `centralNodeId: null`.
 */
export function parseGeneratedGraph(raw: string): GeneratedGraph {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidStructuredGraphError('response is not valid JSON');
  }

  if (!isRecord(parsed)) {
    throw new InvalidStructuredGraphError('response is not an object');
  }

  if (typeof parsed.summary !== 'string') {
    throw new InvalidStructuredGraphError('missing "summary"');
  }

  const graphValue = parsed.graph;
  if (
    !isRecord(graphValue) ||
    !Array.isArray(graphValue.nodes) ||
    !Array.isArray(graphValue.edges)
  ) {
    throw new InvalidStructuredGraphError('missing or malformed "graph"');
  }

  const nodes = graphValue.nodes.filter(isNode).map(normalizeNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graphValue.edges
    .filter(isEdge)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  const graph: KnowledgeGraph = {
    nodes,
    edges,
    // Whether it references an existing node is resolved by the domain (`resolveCentralNodeId`).
    centralNodeId: nonBlankStringOrNull(graphValue.centralNodeId),
  };
  return { summary: parsed.summary, graph };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNode(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.id === 'string' && typeof value.label === 'string';
}

function normalizeNode(value: Record<string, unknown>): KnowledgeGraphNode {
  return {
    id: value.id as string,
    label: value.label as string,
    type: 'concept',
    // A missing, empty or non-string source means the concept has no linked post.
    sourceUrl: nonBlankStringOrNull(value.sourceUrl),
  };
}

function nonBlankStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isEdge(value: unknown): value is KnowledgeGraphEdge {
  return (
    isRecord(value) &&
    typeof value.source === 'string' &&
    typeof value.target === 'string' &&
    typeof value.relationship === 'string'
  );
}

/**
 * Builds a production generator from environment settings.
 */
export function createOllamaStructuredGraphGenerator(
  url: string,
  model: string,
): OllamaStructuredGraphGenerator {
  const ollama = new Ollama({ host: url });
  const client: OllamaChatClient = {
    chat: (request) => ollama.chat({ ...request, stream: false }),
  };
  return new OllamaStructuredGraphGenerator(client, model);
}
