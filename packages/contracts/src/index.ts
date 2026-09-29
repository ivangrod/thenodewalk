export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface TechnicalQueryRequest {
  query: string;
}

/**
 * A concept of the knowledge graph. `sourceUrl` is the post (ingested article)
 * the concept is linked to, or `null` when the concept has no post.
 */
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'concept';
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
 * Final response for `POST /technical-queries`: a natural-language summary plus
 * an interactive knowledge graph whose nodes may link back to their source URL.
 */
export interface TechnicalQueryResponse {
  summary: string;
  graph: KnowledgeGraph;
}
