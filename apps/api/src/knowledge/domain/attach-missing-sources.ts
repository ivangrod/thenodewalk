import type { BookChunkMetadata, PostChunkMetadata } from './knowledge-chunk';
import type { KnowledgeGraph } from './knowledge-graph';

export type RetrievedSource =
  | Pick<PostChunkMetadata, 'sourceType' | 'sourceId' | 'articleTitle'>
  | Pick<BookChunkMetadata, 'sourceType' | 'sourceId' | 'bookTitle' | 'sectionTitle'>;

/** Completes an already grounded, deduplicated and depth-limited graph with source nodes. */
export function attachMissingSources(
  graph: KnowledgeGraph,
  sources: RetrievedSource[],
): KnowledgeGraph {
  const linked = new Set(
    graph.nodes.flatMap(({ sourceId }) => (sourceId === null ? [] : [sourceId])),
  );
  const ids = new Set(graph.nodes.map(({ id }) => id));
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  let centralNodeId =
    graph.centralNodeId !== null && ids.has(graph.centralNodeId)
      ? graph.centralNodeId
      : (nodes[0]?.id ?? null);
  let added = false;

  for (const source of sources) {
    if (linked.has(source.sourceId)) continue;
    const baseId = `source:${source.sourceId}`;
    let id = baseId;
    for (let suffix = 1; ids.has(id); suffix++) id = `${baseId}:${suffix}`;
    ids.add(id);
    linked.add(source.sourceId);
    const label =
      source.sourceType === 'post'
        ? source.articleTitle
        : [source.bookTitle, source.sectionTitle].filter(Boolean).join(' - ');
    nodes.push({ id, label, type: 'concept', sourceId: source.sourceId });
    if (centralNodeId === null) centralNodeId = id;
    else edges.push({ source: centralNodeId, target: id, relationship: 'retrieved source' });
    added = true;
  }
  return added ? { nodes, edges, centralNodeId } : graph;
}
