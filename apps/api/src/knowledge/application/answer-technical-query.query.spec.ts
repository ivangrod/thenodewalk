import {
  AnswerTechnicalQueryQuery,
  TECHNICAL_QUERY_OVERFETCH,
} from './answer-technical-query.query';
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
import { BookChunkMother } from '../domain/testing/book.mother';

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
  it('covers all five balanced sources exactly once, restoring links lost to depth pruning', async () => {
    const books = Array.from({ length: 3 }, (_, index) => ({
      chunk: BookChunkMother.create({ bookId: `book-${index}`, sectionTitle: `Section ${index}` }),
      score: 0.9 - index * 0.1,
    }));
    const posts = [matchWith('https://post.test/first'), matchWith('https://post.test/second')];
    const { query, generator } = buildQuery([...books, ...posts]);
    generator.result = {
      summary: 'Balanced answer',
      graph: {
        nodes: [
          KnowledgeGraphNodeMother.create({
            id: 'central',
            sourceId: posts[0]!.chunk.metadata.sourceId,
          }),
          KnowledgeGraphNodeMother.create({ id: 'concept', sourceId: null }),
          KnowledgeGraphNodeMother.create({
            id: 'duplicate',
            sourceId: posts[0]!.chunk.metadata.sourceId,
          }),
          KnowledgeGraphNodeMother.create({
            id: 'disconnected',
            sourceId: books[0]!.chunk.metadata.sourceId,
          }),
        ],
        edges: [
          { source: 'central', target: 'concept', relationship: 'explains' },
          { source: 'central', target: 'duplicate', relationship: 'relates to' },
        ],
        centralNodeId: 'central',
      },
    };
    const response = await query.execute('Question');
    expect(response.graph.nodes).toHaveLength(7);
    expect(response.graph.nodes.filter(({ source }) => source?.kind === 'book')).toHaveLength(3);
    expect(response.graph.nodes.filter(({ source }) => source?.kind === 'post')).toHaveLength(2);
    expect(response.graph.nodes.filter(({ source }) => source === null)).toHaveLength(2);
    expect(response.graph.nodes.some(({ id }) => id === 'disconnected')).toBe(false);
    expect(response.graph.nodes.find(({ id }) => id === 'duplicate')?.source).toBeNull();
    expect(response.graph.edges).toHaveLength(6);
    expect(response.graph.edges.every(({ source }) => source === 'central')).toBe(true);
    expect(response.summary).toBe('Balanced answer');
  });

  it('builds source nodes from an empty generated graph, while generation failures still return the safe empty response', async () => {
    const chunk = BookChunkMother.create();
    const { query } = buildQuery([{ chunk, score: 0.9 }]);
    const response = await query.execute('Question');
    expect(response.graph.nodes).toHaveLength(1);
    expect(response.graph.centralNodeId).toBe(response.graph.nodes[0]?.id);
    expect(response.graph.nodes[0]?.source?.kind).toBe('book');
  });
  it('starts both searches before either completes, then generates from balanced sources', async () => {
    const books = Array.from({ length: 5 }, (_, index) => ({
      chunk: BookChunkMother.create({ bookId: `book-${index}` }),
      score: 0.8 - index * 0.1,
    }));
    const posts = Array.from({ length: 5 }, (_, index) => ({
      chunk: KnowledgeChunkMother.create({ articleUrl: `https://post.test/${index}` }),
      score: 0.9 - index * 0.1,
    }));
    const { query, repository, embeddings, generator } = buildQuery([]);
    const resolvers: ((matches: KnowledgeSearchMatch[]) => void)[] = [];
    jest.spyOn(repository, 'search').mockImplementation(
      () =>
        new Promise<KnowledgeSearchMatch[]>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const answering = query.execute('Question');
    await Promise.resolve();
    expect(resolvers).toHaveLength(2);
    expect(generator.calls).toHaveLength(0);
    resolvers[0]!(books);
    resolvers[1]!(posts);
    await answering;
    expect(embeddings.queries).toEqual(['Question']);
    const context = generator.calls[0]!.context;
    expect(context.filter(({ chunk }) => chunk.metadata.sourceType === 'book')).toHaveLength(3);
    expect(context.filter(({ chunk }) => chunk.metadata.sourceType === 'post')).toHaveLength(2);
    expect(context[0]).toBe(posts[0]);
    expect(context.map(({ score }) => score)).toEqual(
      [...context.map(({ score }) => score)].sort((a, b) => b - a),
    );
  });
  it('maps a retrieved book section into a book source', async () => {
    const chunk = BookChunkMother.create();
    const { query, generator } = buildQuery([{ chunk, score: 0.9 }]);
    generator.result = {
      summary: 'Book answer',
      graph: {
        nodes: [KnowledgeGraphNodeMother.create({ id: 'book', sourceId: chunk.metadata.sourceId })],
        edges: [],
        centralNodeId: 'book',
      },
    };
    const response = await query.execute('What are feedback loops?');
    expect(response.graph.nodes[0]?.source).toEqual({
      kind: 'book',
      bookTitle: 'Engineering Feedback',
      sectionTitle: 'Feedback',
      pageStart: null,
    });
  });
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
            sourceId: 'https://netflixtechblog.com/post',
          },
        ],
        edges: [{ source: 'gateway', target: 'gateway', relationship: 'self' }],
        centralNodeId: 'gateway',
      },
    };
    generator.result = generated;

    const response = await query.execute('How does Netflix scale its API?');

    expect(embeddings.queries).toEqual(['How does Netflix scale its API?']);
    expect(embeddings.documentBatches).toEqual([]);
    expect(repository.searchCalls).toEqual([
      { embedding: [0.5, 0.5], limit: TECHNICAL_QUERY_OVERFETCH, filter: { sourceType: 'book' } },
      { embedding: [0.5, 0.5], limit: TECHNICAL_QUERY_OVERFETCH, filter: { sourceType: 'post' } },
    ]);
    expect(generator.calls).toHaveLength(1);
    expect(response.summary).toBe('Netflix uses a federated API gateway.');
    expect(response.graph.nodes[0]?.source).toEqual({
      kind: 'post',
      url: 'https://netflixtechblog.com/post',
    });
    expect(response.graph.edges).toHaveLength(1);
  });

  it('returns nodes without a source with a null source', async () => {
    const { query, generator } = buildQuery([matchWith('https://blog.test/post')]);
    generator.result = {
      summary: 'Event sourcing stores changes as events.',
      graph: {
        nodes: [
          {
            id: 'event-sourcing',
            label: 'Event Sourcing',
            type: 'concept',
            sourceId: 'https://blog.test/post',
          },
          { id: 'event', label: 'Domain Event', type: 'concept', sourceId: null },
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
        source: { kind: 'post', url: 'https://blog.test/post' },
      },
      { id: 'event', label: 'Domain Event', type: 'concept', source: null },
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
          KnowledgeGraphNodeMother.create({ id: 'kafka', sourceId: sharedUrl }),
          KnowledgeGraphNodeMother.create({ id: 'topic', sourceId: sharedUrl }),
          KnowledgeGraphNodeMother.create({ id: 'partition', sourceId: sharedUrl }),
        ],
        edges: [
          { source: 'kafka', target: 'topic', relationship: 'organizes' },
          { source: 'topic', target: 'partition', relationship: 'splits into' },
        ],
        centralNodeId: 'kafka',
      },
    };

    const response = await query.execute('How does Kafka store data?');

    expect(response.graph.nodes.map((node) => [node.id, node.source])).toEqual([
      ['kafka', { kind: 'post', url: sharedUrl }],
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
          KnowledgeGraphNodeMother.create({ id: 'grounded', sourceId: retrievedUrl }),
          KnowledgeGraphNodeMother.create({
            id: 'invented',
            sourceId: 'https://blog.test/hallucinated',
          }),
        ],
        edges: [KnowledgeGraphEdgeMother.create({ source: 'grounded', target: 'invented' })],
        centralNodeId: 'grounded',
      },
    };

    const response = await query.execute('a question');

    expect(response.graph.nodes.map((node) => [node.id, node.source])).toEqual([
      ['grounded', { kind: 'post', url: retrievedUrl }],
      ['invented', null],
    ]);
  });

  it('returns the graph limited to 3 levels from the central node', async () => {
    const { query, generator } = buildQuery([matchWith('https://blog.test/main')]);
    const chain = Array.from({ length: MAX_GRAPH_DEPTH + 3 }, () =>
      KnowledgeGraphNodeMother.create({ sourceId: null }),
    );
    const central = chain[0] as KnowledgeGraphNode;
    central.sourceId = 'https://blog.test/main';
    const disconnected = KnowledgeGraphNodeMother.create({ sourceId: null });
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
    const secondary = KnowledgeGraphNodeMother.create({ sourceId: secondaryUrl });
    const mainIdea = KnowledgeGraphNodeMother.create({ sourceId: mainPostUrl });
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
