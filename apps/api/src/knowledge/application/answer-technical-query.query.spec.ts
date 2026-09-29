import { AnswerTechnicalQueryQuery, TECHNICAL_QUERY_TOP_K } from './answer-technical-query.query';
import {
  InMemoryKnowledgeChunkRepository,
  StubEmbeddingGenerator,
  StubStructuredGraphGenerator,
} from './testing/knowledge-test-doubles';
import {
  KnowledgeChunkMother,
  KnowledgeGraphEdgeMother,
  KnowledgeGraphNodeMother,
} from '../domain/testing/knowledge.mother';
import type { KnowledgeSearchMatch } from '../domain/knowledge-chunk-repository';
import type { GeneratedGraph, KnowledgeGraphNode } from '../domain/knowledge-graph';
import { MAX_GRAPH_DEPTH } from '../domain/knowledge-graph-focus';

function matchWith(articleUrl: string): KnowledgeSearchMatch {
  return { chunk: KnowledgeChunkMother.create({ articleUrl }), score: 0.9 };
}

function buildQuery(matches: KnowledgeSearchMatch[]): {
  query: AnswerTechnicalQueryQuery;
  embeddings: StubEmbeddingGenerator;
  repository: InMemoryKnowledgeChunkRepository;
  generator: StubStructuredGraphGenerator;
} {
  const embeddings = new StubEmbeddingGenerator([0.5, 0.5]);
  const repository = new InMemoryKnowledgeChunkRepository();
  repository.matches = matches;
  const generator = new StubStructuredGraphGenerator();
  const query = new AnswerTechnicalQueryQuery(embeddings, repository, generator);
  return { query, embeddings, repository, generator };
}

describe('AnswerTechnicalQueryQuery', () => {
  it('embeds the question once, retrieves Top-K context and returns summary + graph', async () => {
    const { query, embeddings, repository, generator } = buildQuery([
      matchWith('https://netflixtechblog.com/post'),
    ]);
    const generated: GeneratedGraph = {
      summary: 'Netflix uses a federated API gateway.',
      graph: {
        nodes: [
          {
            id: 'gateway',
            label: 'API Gateway',
            type: 'concept',
            sourceUrl: 'https://netflixtechblog.com/post',
          },
        ],
        edges: [{ source: 'gateway', target: 'gateway', relationship: 'self' }],
        centralNodeId: 'gateway',
      },
    };
    generator.result = generated;

    const response = await query.execute('How does Netflix scale its API?');

    expect(embeddings.prompts).toEqual(['How does Netflix scale its API?']);
    expect(repository.searchCalls[0]?.limit).toBe(TECHNICAL_QUERY_TOP_K);
    expect(generator.calls).toHaveLength(1);
    expect(response.summary).toBe('Netflix uses a federated API gateway.');
    expect(response.graph.nodes[0]?.sourceUrl).toBe('https://netflixtechblog.com/post');
    expect(response.graph.edges).toHaveLength(1);
  });

  it('returns nodes without a source with a null sourceUrl', async () => {
    const { query, generator } = buildQuery([matchWith('https://blog.test/post')]);
    generator.result = {
      summary: 'Event sourcing stores changes as events.',
      graph: {
        nodes: [
          {
            id: 'event-sourcing',
            label: 'Event Sourcing',
            type: 'concept',
            sourceUrl: 'https://blog.test/post',
          },
          { id: 'event', label: 'Domain Event', type: 'concept', sourceUrl: null },
        ],
        edges: [{ source: 'event-sourcing', target: 'event', relationship: 'stores' }],
        centralNodeId: 'event-sourcing',
      },
    };

    const response = await query.execute('What is event sourcing?');

    expect(response.graph.nodes).toEqual([
      {
        id: 'event-sourcing',
        label: 'Event Sourcing',
        type: 'concept',
        sourceUrl: 'https://blog.test/post',
      },
      { id: 'event', label: 'Domain Event', type: 'concept', sourceUrl: null },
    ]);
    expect(response.graph.edges).toHaveLength(1);
  });

  it('never returns two nodes linked to the same source', async () => {
    const sharedUrl = 'https://blog.test/kafka';
    const { query, generator } = buildQuery([matchWith(sharedUrl), matchWith(sharedUrl)]);
    generator.result = {
      summary: 'Kafka stores records in partitioned topics.',
      graph: {
        nodes: [
          KnowledgeGraphNodeMother.create({ id: 'kafka', sourceUrl: sharedUrl }),
          KnowledgeGraphNodeMother.create({ id: 'topic', sourceUrl: sharedUrl }),
          KnowledgeGraphNodeMother.create({ id: 'partition', sourceUrl: sharedUrl }),
        ],
        edges: [
          { source: 'kafka', target: 'topic', relationship: 'organizes' },
          { source: 'topic', target: 'partition', relationship: 'splits into' },
        ],
        centralNodeId: 'kafka',
      },
    };

    const response = await query.execute('How does Kafka store data?');

    expect(response.graph.nodes.map((node) => [node.id, node.sourceUrl])).toEqual([
      ['kafka', sharedUrl],
      ['topic', null],
      ['partition', null],
    ]);
    expect(response.graph.edges).toHaveLength(2);
  });

  it('clears sources that are not among the retrieved chunks', async () => {
    const retrievedUrl = 'https://blog.test/retrieved';
    const { query, generator } = buildQuery([matchWith(retrievedUrl)]);
    generator.result = {
      summary: 'A summary.',
      graph: {
        nodes: [
          KnowledgeGraphNodeMother.create({ id: 'grounded', sourceUrl: retrievedUrl }),
          KnowledgeGraphNodeMother.create({
            id: 'invented',
            sourceUrl: 'https://blog.test/hallucinated',
          }),
        ],
        edges: [KnowledgeGraphEdgeMother.create({ source: 'grounded', target: 'invented' })],
        centralNodeId: 'grounded',
      },
    };

    const response = await query.execute('a question');

    expect(response.graph.nodes.map((node) => [node.id, node.sourceUrl])).toEqual([
      ['grounded', retrievedUrl],
      ['invented', null],
    ]);
  });

  it('returns the graph limited to 3 levels from the central node', async () => {
    const { query, generator } = buildQuery([matchWith('https://blog.test/main')]);
    const chain = Array.from({ length: MAX_GRAPH_DEPTH + 3 }, () =>
      KnowledgeGraphNodeMother.create({ sourceUrl: null }),
    );
    const central = chain[0] as KnowledgeGraphNode;
    const disconnected = KnowledgeGraphNodeMother.create({ sourceUrl: null });
    generator.result = {
      summary: 'A deep graph.',
      graph: {
        nodes: [...chain, disconnected],
        edges: chain
          .slice(1)
          .map((node, index) =>
            KnowledgeGraphEdgeMother.between(chain[index] as KnowledgeGraphNode, node),
          ),
        centralNodeId: central.id,
      },
    };

    const response = await query.execute('a deep question');

    expect(response.graph.centralNodeId).toBe(central.id);
    expect(response.graph.nodes.map((node) => node.id)).toEqual(
      chain.slice(0, MAX_GRAPH_DEPTH + 1).map((node) => node.id),
    );
    expect(response.graph.edges).toHaveLength(MAX_GRAPH_DEPTH);
  });

  it('uses the node linked to the most relevant post as central node when the generator does not provide a valid one', async () => {
    const mainPostUrl = 'https://blog.test/main';
    const secondaryUrl = 'https://blog.test/secondary';
    const { query, generator } = buildQuery([matchWith(mainPostUrl), matchWith(secondaryUrl)]);
    const secondary = KnowledgeGraphNodeMother.create({ sourceUrl: secondaryUrl });
    const mainIdea = KnowledgeGraphNodeMother.create({ sourceUrl: mainPostUrl });
    generator.result = {
      summary: 'A summary.',
      graph: {
        nodes: [secondary, mainIdea],
        edges: [KnowledgeGraphEdgeMother.between(mainIdea, secondary)],
        centralNodeId: 'not-a-node',
      },
    };

    const response = await query.execute('a question');

    expect(response.graph.centralNodeId).toBe(mainIdea.id);
    expect(response.graph.nodes).toHaveLength(2);
  });

  it('returns an empty graph and an explanatory summary when nothing is retrieved', async () => {
    const { query, generator } = buildQuery([]);

    const response = await query.execute('an unknown topic');

    expect(response.graph).toEqual({ nodes: [], edges: [], centralNodeId: null });
    expect(response.summary.length).toBeGreaterThan(0);
    expect(generator.calls).toHaveLength(0);
  });

  it('surfaces a safe response when structured generation fails', async () => {
    const { query, generator } = buildQuery([matchWith('https://blog.test/post')]);
    generator.error = new Error('model returned garbage');

    const response = await query.execute('a question');

    expect(response.graph).toEqual({ nodes: [], edges: [], centralNodeId: null });
    expect(response.summary.length).toBeGreaterThan(0);
  });
});
