import { attachMissingSources, type RetrievedSource } from './attach-missing-sources';
import { EMPTY_GRAPH, type KnowledgeGraph } from './knowledge-graph';
import { limitGraphDepth, MAX_GRAPH_DEPTH } from './knowledge-graph-focus';
import { KnowledgeGraphNodeMother } from './testing/knowledge.mother';

const SOURCES: RetrievedSource[] = [
  { sourceType: 'book', sourceId: 'book#0', bookTitle: 'Engineering', sectionTitle: 'Feedback' },
  { sourceType: 'post', sourceId: 'https://post.test', articleTitle: 'Review practices' },
];

describe('attachMissingSources', () => {
  it('adds labelled missing book/post nodes linked to the central node without mutating the graph', () => {
    const central = KnowledgeGraphNodeMother.create({ id: 'central', sourceId: null });
    const graph: KnowledgeGraph = { nodes: [central], edges: [], centralNodeId: central.id };
    const result = attachMissingSources(graph, SOURCES);
    expect(result.nodes.map(({ label }) => label)).toEqual([
      central.label,
      'Engineering - Feedback',
      'Review practices',
    ]);
    expect(result.nodes.slice(1).map(({ sourceId }) => sourceId)).toEqual(
      SOURCES.map(({ sourceId }) => sourceId),
    );
    expect(result.edges).toEqual(
      result.nodes
        .slice(1)
        .map(({ id }) => ({ source: 'central', target: id, relationship: 'retrieved source' })),
    );
    expect(graph).toEqual({ nodes: [central], edges: [], centralNodeId: 'central' });
    expect(limitGraphDepth(result, MAX_GRAPH_DEPTH)).toEqual(result);
  });

  it('preserves already linked sources, deduplicates input and is idempotent', () => {
    const node = KnowledgeGraphNodeMother.create({ sourceId: 'book#0' });
    const graph = { nodes: [node], edges: [], centralNodeId: node.id };
    const result = attachMissingSources(graph, [...SOURCES, ...SOURCES]);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toBe(node);
    expect(attachMissingSources(result, SOURCES)).toBe(result);
    expect(attachMissingSources(graph, [])).toBe(graph);
  });

  it('constructs a source-only graph when generation returned no nodes', () => {
    const result = attachMissingSources(EMPTY_GRAPH, SOURCES);
    expect(result.centralNodeId).toBe(result.nodes[0]?.id);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(limitGraphDepth(result, MAX_GRAPH_DEPTH)).toEqual(result);
    expect(attachMissingSources(EMPTY_GRAPH, [])).toBe(EMPTY_GRAPH);
  });

  it('avoids collisions with generated node ids deterministically', () => {
    const node = KnowledgeGraphNodeMother.create({ id: 'source:book#0', sourceId: null });
    const graph = { nodes: [node], edges: [], centralNodeId: node.id };
    const result = attachMissingSources(graph, SOURCES);
    expect(result.nodes[1]?.id).toBe('source:book#0:1');
    expect(new Set(result.nodes.map(({ id }) => id)).size).toBe(3);
    expect(attachMissingSources(graph, SOURCES)).toEqual(result);
  });

  it('uses the book title alone when the section title is empty and resolves an invalid centre', () => {
    const node = KnowledgeGraphNodeMother.create({ sourceId: null });
    const result = attachMissingSources({ nodes: [node], edges: [], centralNodeId: 'missing' }, [
      { sourceType: 'book', sourceId: 'book', bookTitle: 'Engineering', sectionTitle: '' },
    ]);
    expect(result.nodes[1]?.label).toBe('Engineering');
    expect(result.centralNodeId).toBe(node.id);
    expect(result.edges[0]?.source).toBe(node.id);
  });
});
