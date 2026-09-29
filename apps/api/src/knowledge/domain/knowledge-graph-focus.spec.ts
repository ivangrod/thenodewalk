import { faker } from '@faker-js/faker';

import { limitGraphDepth, MAX_GRAPH_DEPTH, resolveCentralNodeId } from './knowledge-graph-focus';
import type { KnowledgeGraph, KnowledgeGraphNode } from './knowledge-graph';
import { KnowledgeGraphEdgeMother, KnowledgeGraphNodeMother } from './testing/knowledge.mother';

/** Builds a chain `nodes[0] - nodes[1] - ... - nodes[n]` centred on `nodes[0]`. */
function chainGraph(length: number): { graph: KnowledgeGraph; nodes: KnowledgeGraphNode[] } {
  const nodes = Array.from({ length }, () => KnowledgeGraphNodeMother.create());
  const edges = nodes
    .slice(1)
    .map((node, index) =>
      KnowledgeGraphEdgeMother.between(nodes[index] as KnowledgeGraphNode, node),
    );
  return { graph: { nodes, edges, centralNodeId: nodes[0]?.id ?? null }, nodes };
}

describe('resolveCentralNodeId', () => {
  it('keeps the central node proposed by the generator when it exists', () => {
    const mainPostUrl = faker.internet.url();
    const mainPostNode = KnowledgeGraphNodeMother.create({ sourceUrl: mainPostUrl });
    const proposed = KnowledgeGraphNodeMother.create();
    const graph: KnowledgeGraph = {
      nodes: [mainPostNode, proposed],
      edges: [],
      centralNodeId: proposed.id,
    };

    expect(resolveCentralNodeId(graph, mainPostUrl)).toBe(proposed.id);
  });

  it('falls back to the first node linked to the main post when the proposed one is unknown', () => {
    const mainPostUrl = faker.internet.url();
    const other = KnowledgeGraphNodeMother.create();
    const withoutSource = KnowledgeGraphNodeMother.create({ sourceUrl: null });
    const mainPostNode = KnowledgeGraphNodeMother.create({ sourceUrl: mainPostUrl });
    const graph: KnowledgeGraph = {
      nodes: [other, withoutSource, mainPostNode],
      edges: [],
      centralNodeId: 'unknown-node',
    };

    expect(resolveCentralNodeId(graph, mainPostUrl)).toBe(mainPostNode.id);
  });

  it('falls back to the first node when no node is linked to the main post', () => {
    const first = KnowledgeGraphNodeMother.create({ sourceUrl: null });
    const graph: KnowledgeGraph = {
      nodes: [first, KnowledgeGraphNodeMother.create()],
      edges: [],
      centralNodeId: null,
    };

    expect(resolveCentralNodeId(graph, faker.internet.url())).toBe(first.id);
  });

  it('returns null for an empty graph', () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [], centralNodeId: 'ghost' };

    expect(resolveCentralNodeId(graph, faker.internet.url())).toBeNull();
  });
});

describe('limitGraphDepth', () => {
  it('keeps every node within 3 levels of the central node', () => {
    const { graph } = chainGraph(MAX_GRAPH_DEPTH + 1);

    const result = limitGraphDepth(graph, MAX_GRAPH_DEPTH);

    expect(result).toEqual(graph);
  });

  it('drops nodes further than 3 levels and the edges referencing them', () => {
    const { graph, nodes } = chainGraph(MAX_GRAPH_DEPTH + 3);

    const result = limitGraphDepth(graph, MAX_GRAPH_DEPTH);

    expect(result.nodes).toEqual(nodes.slice(0, MAX_GRAPH_DEPTH + 1));
    expect(result.edges).toEqual(graph.edges.slice(0, MAX_GRAPH_DEPTH));
    expect(result.centralNodeId).toBe(graph.centralNodeId);
  });

  it('counts levels ignoring the edge direction', () => {
    const central = KnowledgeGraphNodeMother.create();
    const levelOne = KnowledgeGraphNodeMother.create();
    const levelTwo = KnowledgeGraphNodeMother.create();
    const levelThree = KnowledgeGraphNodeMother.create();
    const levelFour = KnowledgeGraphNodeMother.create();
    const graph: KnowledgeGraph = {
      nodes: [central, levelOne, levelTwo, levelThree, levelFour],
      edges: [
        KnowledgeGraphEdgeMother.between(levelOne, central),
        KnowledgeGraphEdgeMother.between(levelOne, levelTwo),
        KnowledgeGraphEdgeMother.between(levelThree, levelTwo),
        KnowledgeGraphEdgeMother.between(levelFour, levelThree),
      ],
      centralNodeId: central.id,
    };

    const result = limitGraphDepth(graph, MAX_GRAPH_DEPTH);

    expect(result.nodes).toEqual([central, levelOne, levelTwo, levelThree]);
    expect(result.edges).toEqual(graph.edges.slice(0, 3));
  });

  it('drops nodes not connected to the central node', () => {
    const central = KnowledgeGraphNodeMother.create();
    const connected = KnowledgeGraphNodeMother.create();
    const isolated = KnowledgeGraphNodeMother.create();
    const islandA = KnowledgeGraphNodeMother.create();
    const islandB = KnowledgeGraphNodeMother.create();
    const graph: KnowledgeGraph = {
      nodes: [central, connected, isolated, islandA, islandB],
      edges: [
        KnowledgeGraphEdgeMother.between(central, connected),
        KnowledgeGraphEdgeMother.between(islandA, islandB),
      ],
      centralNodeId: central.id,
    };

    const result = limitGraphDepth(graph, MAX_GRAPH_DEPTH);

    expect(result.nodes).toEqual([central, connected]);
    expect(result.edges).toEqual([graph.edges[0]]);
  });

  it('returns the graph unchanged when there is no central node', () => {
    const { graph } = chainGraph(MAX_GRAPH_DEPTH + 3);
    const withoutCentral: KnowledgeGraph = { ...graph, centralNodeId: null };

    expect(limitGraphDepth(withoutCentral, MAX_GRAPH_DEPTH)).toEqual(withoutCentral);
  });
});
