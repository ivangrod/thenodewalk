/**
 * Domain model of the knowledge graph produced from a technical query. Mirrors
 * the shared contract structure but uses source identities within the domain.
 */
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'concept';
  /** Identity of the retrieved source linked to the concept, or `null` when it has none. */
  sourceId: string | null;
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
 * - A node can only be linked to a source that was retrieved as context.
 * - A source is linked to at most one node: the first node (in graph order) that
 *   references it keeps it.
 *
 * Any other source is cleared (`sourceId: null`). Nodes and edges are always
 * preserved, so the graph structure never changes.
 */
export function assignUniqueSources(
  graph: KnowledgeGraph,
  retrievedSourceIds: ReadonlySet<string>,
): KnowledgeGraph {
  const linkedSourceIds = new Set<string>();

  const nodes = graph.nodes.map((node): KnowledgeGraphNode => {
    const { sourceId } = node;
    if (sourceId === null) {
      return node;
    }
    if (!retrievedSourceIds.has(sourceId) || linkedSourceIds.has(sourceId)) {
      return { ...node, sourceId: null };
    }
    linkedSourceIds.add(sourceId);
    return node;
  });

  return { ...graph, nodes };
}
