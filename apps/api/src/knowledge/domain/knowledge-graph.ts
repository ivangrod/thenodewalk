/**
 * Domain model of the knowledge graph produced from a technical query. Mirrors
 * the shared contract shape but keeps the domain free of the contracts package.
 */
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'concept';
  /** URL of the post (ingested article) linked to the concept, or `null` when it has none. */
  sourceUrl: string | null;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/**
 * The full answer to a technical query: a natural-language summary plus the
 * structured graph of concepts.
 */
export interface GeneratedGraph {
  summary: string;
  graph: KnowledgeGraph;
}

export const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] };
