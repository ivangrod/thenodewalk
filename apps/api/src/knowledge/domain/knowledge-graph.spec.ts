import { faker } from '@faker-js/faker';

import { assignUniqueSources, type KnowledgeGraph } from './knowledge-graph';
import { KnowledgeGraphNodeMother } from './testing/knowledge.mother';

describe('assignUniqueSources', () => {
  it('keeps every source when all sources are unique and retrieved', () => {
    const [firstUrl = '', secondUrl = ''] = faker.helpers.uniqueArray(faker.internet.url, 2);
    const graph: KnowledgeGraph = {
      nodes: [
        KnowledgeGraphNodeMother.create({ sourceId: firstUrl }),
        KnowledgeGraphNodeMother.create({ sourceId: secondUrl }),
      ],
      edges: [],
      centralNodeId: null,
    };

    const result = assignUniqueSources(graph, new Set([firstUrl, secondUrl]));

    expect(result.nodes.map((node) => node.sourceId)).toEqual([firstUrl, secondUrl]);
  });

  it('keeps a shared source only in the first node that references it', () => {
    const sharedUrl = faker.internet.url();
    const graph: KnowledgeGraph = {
      nodes: [
        KnowledgeGraphNodeMother.create({ id: 'first', sourceId: sharedUrl }),
        KnowledgeGraphNodeMother.create({ id: 'second', sourceId: sharedUrl }),
        KnowledgeGraphNodeMother.create({ id: 'third', sourceId: sharedUrl }),
      ],
      edges: [],
      centralNodeId: null,
    };

    const result = assignUniqueSources(graph, new Set([sharedUrl]));

    expect(result.nodes.map((node) => [node.id, node.sourceId])).toEqual([
      ['first', sharedUrl],
      ['second', null],
      ['third', null],
    ]);
  });

  it('clears sources that were not retrieved', () => {
    const retrievedUrl = faker.internet.url();
    const graph: KnowledgeGraph = {
      nodes: [
        KnowledgeGraphNodeMother.create({ sourceId: 'https://invented.test/hallucinated' }),
        KnowledgeGraphNodeMother.create({ sourceId: retrievedUrl }),
      ],
      edges: [],
      centralNodeId: null,
    };

    const result = assignUniqueSources(graph, new Set([retrievedUrl]));

    expect(result.nodes.map((node) => node.sourceId)).toEqual([null, retrievedUrl]);
  });

  it('leaves nodes without a source untouched', () => {
    const retrievedUrl = faker.internet.url();
    const withoutSource = KnowledgeGraphNodeMother.create({ sourceId: null });
    const graph: KnowledgeGraph = {
      nodes: [withoutSource, KnowledgeGraphNodeMother.create({ sourceId: retrievedUrl })],
      edges: [],
      centralNodeId: null,
    };

    const result = assignUniqueSources(graph, new Set([retrievedUrl]));

    expect(result.nodes[0]).toEqual(withoutSource);
    expect(result.nodes[1]?.sourceId).toBe(retrievedUrl);
  });

  it('preserves every node, edge and the central node', () => {
    const sharedUrl = faker.internet.url();
    const first = KnowledgeGraphNodeMother.create({ sourceId: sharedUrl });
    const second = KnowledgeGraphNodeMother.create({ sourceId: sharedUrl });
    const unknown = KnowledgeGraphNodeMother.create();
    const graph: KnowledgeGraph = {
      nodes: [first, second, unknown],
      edges: [
        { source: first.id, target: second.id, relationship: 'relates to' },
        { source: second.id, target: unknown.id, relationship: 'depends on' },
      ],
      centralNodeId: first.id,
    };

    const result = assignUniqueSources(graph, new Set([sharedUrl]));

    expect(result.nodes.map(({ id, label, type }) => ({ id, label, type }))).toEqual(
      graph.nodes.map(({ id, label, type }) => ({ id, label, type })),
    );
    expect(result.edges).toEqual(graph.edges);
    expect(result.centralNodeId).toBe(first.id);
  });
});
