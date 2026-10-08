export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface TechnicalQueryRequest {
  query: string;
}

/**
 * An ingested post (engineering blog article). Provenance fields come from the
 * indexed chunk metadata, never from the language model; unknown values are null.
 */
export interface KnowledgePostSource {
  kind: 'post';
  url: string;
  articleTitle: string | null;
  blogName: string | null;
  publishedAt: string | null;
}

/** A section (chapter) of an ingested book. Local file paths are never exposed. */
export interface KnowledgeBookSource {
  kind: 'book';
  bookTitle: string;
  sectionTitle: string | null;
  pageStart: number | null;
}

export type KnowledgeNodeSource = KnowledgePostSource | KnowledgeBookSource;

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
 * `centralNodeId` is the node holding the main idea of the graph. Every
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
 * an interactive knowledge graph whose nodes may link back to their source.
 */
export interface TechnicalQueryResponse {
  summary: string;
  graph: KnowledgeGraph;
}
