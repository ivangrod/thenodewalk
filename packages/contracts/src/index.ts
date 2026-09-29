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
