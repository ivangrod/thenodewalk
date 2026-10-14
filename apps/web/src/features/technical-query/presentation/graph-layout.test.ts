import { describe, expect, it } from 'vitest';
import type { KnowledgeGraph } from '@thenodewalk/contracts';
import { layoutKnowledgeGraph, segmentsCross } from './graph-layout';

describe('layoutKnowledgeGraph', () => {
  it('untangles a cycle whose input order would cross and preserves the central position', () => {
    const graph: KnowledgeGraph = {
      nodes: ['centre', 'a', 'c', 'b', 'd'].map((id) => ({
        id,
        label: id,
        type: 'concept',
        source: null,
      })),
      edges: [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'd'],
        ['d', 'a'],
      ].map(([source, target]) => ({ source: source!, target: target!, relationship: 'uses' })),
      centralNodeId: 'centre',
    };
    const positions = layoutKnowledgeGraph(graph);
    expect(positions.get('centre')).toEqual({ x: 0, y: 0 });
    for (const edge of graph.edges) {
      for (const other of graph.edges) {
        if (
          [edge.source, edge.target].includes(other.source) ||
          [edge.source, edge.target].includes(other.target)
        )
          continue;
        expect(
          segmentsCross(
            positions.get(edge.source)!,
            positions.get(edge.target)!,
            positions.get(other.source)!,
            positions.get(other.target)!,
          ),
        ).toBe(false);
      }
    }
    expect(layoutKnowledgeGraph(graph)).toEqual(positions);
    expect(new Set([...positions.values()].map(({ x, y }) => `${x},${y}`)).size).toBe(5);
  });

  it('supports empty graphs and bounded layout of larger graphs', () => {
    expect(layoutKnowledgeGraph({ nodes: [], edges: [], centralNodeId: null }).size).toBe(0);
    const graph: KnowledgeGraph = {
      nodes: Array.from({ length: 20 }, (_, index) => ({
        id: String(index),
        label: String(index),
        type: 'concept',
        source: null,
      })),
      edges: [],
      centralNodeId: null,
    };
    expect(layoutKnowledgeGraph(graph).size).toBe(20);
  });
});
