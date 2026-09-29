import type { KnowledgeGraph } from './knowledge-graph';

/** Maximum number of levels (hops) a node can be away from the central node. */
export const MAX_GRAPH_DEPTH = 3;

/**
 * Resolves the node holding the main idea (post) of the graph:
 * 1. The central node proposed by the generator, when it references an existing node.
 * 2. Otherwise, the first node linked to the main post (the most relevant source).
 * 3. Otherwise, the first node of the graph.
 *
 * Returns `null` only when the graph has no nodes.
 */
export function resolveCentralNodeId(graph: KnowledgeGraph, mainPostUrl: string): string | null {
  const { nodes, centralNodeId } = graph;

  if (centralNodeId !== null && nodes.some((node) => node.id === centralNodeId)) {
    return centralNodeId;
  }

  const mainPostNode = nodes.find((node) => node.sourceUrl === mainPostUrl);
  return mainPostNode?.id ?? nodes[0]?.id ?? null;
}

/**
 * Keeps only the nodes that are at most `maxDepth` levels away from the central
 * node, counting levels regardless of the edge direction. Nodes not connected to
 * the central node are dropped, together with every edge referencing a dropped
 * node. The graph is returned unchanged when it has no (known) central node.
 */
export function limitGraphDepth(graph: KnowledgeGraph, maxDepth: number): KnowledgeGraph {
  const { centralNodeId } = graph;
  if (centralNodeId === null || !graph.nodes.some((node) => node.id === centralNodeId)) {
    return graph;
  }

  const neighbours = buildUndirectedAdjacency(graph);
  const reachable = new Set<string>([centralNodeId]);
  let frontier = [centralNodeId];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbour of neighbours.get(nodeId) ?? []) {
        if (!reachable.has(neighbour)) {
          reachable.add(neighbour);
          next.push(neighbour);
        }
      }
    }
    frontier = next;
  }

  return {
    nodes: graph.nodes.filter((node) => reachable.has(node.id)),
    edges: graph.edges.filter((edge) => reachable.has(edge.source) && reachable.has(edge.target)),
    centralNodeId,
  };
}

function buildUndirectedAdjacency(graph: KnowledgeGraph): Map<string, Set<string>> {
  const neighbours = new Map<string, Set<string>>();
  const link = (from: string, to: string): void => {
    const current = neighbours.get(from) ?? new Set<string>();
    current.add(to);
    neighbours.set(from, current);
  };

  for (const edge of graph.edges) {
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }

  return neighbours;
}
