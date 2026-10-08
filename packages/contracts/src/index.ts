export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface TechnicalQueryRequest {
  query: string;
}

export type KnowledgeNodeSource =
  | { kind: 'post'; url: string }
  | { kind: 'book'; bookTitle: string; sectionTitle: string | null; pageStart: number | null };

/** A concept linked to a retrieved source, or `null` when it has none. */
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'concept';
  source: KnowledgeNodeSource | null;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationship: string;
}

/**
 * `centralNodeId` is the node holding the main idea (post) of the graph. Every
 * other node is at most 3 levels away from it. It is `null` only when the graph
 * has no nodes.
 */
export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  centralNodeId: string | null;
}

/**
 * Final response for `POST /technical-queries`: a natural-language summary plus
 * an interactive knowledge graph whose nodes may link back to their source URL.
 */
export interface TechnicalQueryResponse {
  summary: string;
  graph: KnowledgeGraph;
}
