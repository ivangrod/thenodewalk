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
  /** Node holding the main idea (post) of the graph, or `null` when it is unknown or the graph is empty. */
  centralNodeId: string | null;
}

/**
 * The full answer to a technical query: a natural-language summary plus the
 * structured graph of concepts.
 */
export interface GeneratedGraph {
  summary: string;
  graph: KnowledgeGraph;
}

export const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [], centralNodeId: null };

/**
 * Enforces the source invariants of a knowledge graph:
 * - A node can only be linked to a post that was retrieved as context.
 * - A post is linked to at most one node: the first node (in graph order) that
 *   references it keeps it.
 *
 * Any other source is cleared (`sourceUrl: null`). Nodes and edges are always
 * preserved, so the graph structure never changes.
 */
export function assignUniqueSources(
  graph: KnowledgeGraph,
  retrievedSourceUrls: ReadonlySet<string>,
): KnowledgeGraph {
  const linkedSourceUrls = new Set<string>();

  const nodes = graph.nodes.map((node): KnowledgeGraphNode => {
    const { sourceUrl } = node;
    if (sourceUrl === null) {
      return node;
    }
    if (!retrievedSourceUrls.has(sourceUrl) || linkedSourceUrls.has(sourceUrl)) {
      return { ...node, sourceUrl: null };
    }
    linkedSourceUrls.add(sourceUrl);
    return node;
  });

  return { ...graph, nodes };
}
