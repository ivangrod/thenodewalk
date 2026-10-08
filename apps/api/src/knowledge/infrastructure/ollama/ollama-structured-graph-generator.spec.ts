import {
  DEFAULT_OLLAMA_GENERATION_SETTINGS,
  InvalidStructuredGraphError,
  OllamaStructuredGraphGenerator,
  ollamaGenerationSettingsFromEnv,
  parseGeneratedGraph,
  type OllamaChatClient,
} from './ollama-structured-graph-generator';
import { KnowledgeChunkMother } from '../../domain/testing/knowledge.mother';
import { BookChunkMother } from '../../domain/testing/book.mother';
import type { KnowledgeSearchMatch } from '../../domain/knowledge-chunk-repository';

class FakeOllamaChatClient implements OllamaChatClient {
  lastRequest?: Parameters<OllamaChatClient['chat']>[0];

  constructor(private readonly content: string) {}

  chat(
    request: Parameters<OllamaChatClient['chat']>[0],
  ): Promise<{ message: { content: string } }> {
    this.lastRequest = request;
    return Promise.resolve({ message: { content: this.content } });
  }
}

function context(articleUrl: string): KnowledgeSearchMatch {
  return { chunk: KnowledgeChunkMother.create({ articleUrl }), score: 0.8 };
}

const VALID_JSON = JSON.stringify({
  summary: 'Kafka decouples producers from consumers.',
  graph: {
    nodes: [
      { id: 'kafka', label: 'Apache Kafka', type: 'concept', source: 'S1' },
      { id: 'broker', label: 'Broker', type: 'concept', source: 'S1' },
    ],
    edges: [{ source: 'kafka', target: 'broker', relationship: 'contains' }],
    centralNodeId: 'kafka',
  },
});

describe('OllamaStructuredGraphGenerator', () => {
  it('describes book and post sources with opaque labels and clears unknown labels', async () => {
    const client = new FakeOllamaChatClient(
      JSON.stringify({
        summary: 'Answer',
        graph: {
          nodes: [
            { id: 'book', label: 'Feedback', source: 'S1' },
            { id: 'unknown', label: 'Unknown', source: 'S99' },
          ],
          edges: [],
          centralNodeId: 'book',
        },
      }),
    );
    const book = BookChunkMother.create();
    const post = KnowledgeChunkMother.create({ articleTitle: 'Post title', blogName: 'Blog' });
    const result = await new OllamaStructuredGraphGenerator(client, 'model').generate('Question', [
      { chunk: book, score: 1 },
      { chunk: post, score: 0.9 },
    ]);
    expect(client.lastRequest?.messages[1]?.content).toContain(
      'S1 (Book: Engineering Feedback; section: Feedback)',
    );
    expect(client.lastRequest?.messages[1]?.content).toContain('S2 (Post: Post title; blog: Blog)');
    expect(result.graph.nodes.map(({ sourceId }) => sourceId)).toEqual([
      book.metadata.sourceId,
      null,
    ]);
  });
  it('requests JSON output and maps source labels into domain identities', async () => {
    const client = new FakeOllamaChatClient(VALID_JSON);
    const generator = new OllamaStructuredGraphGenerator(client, 'llama3.1:8b');

    const result = await generator.generate('What is Kafka?', [context('https://blog.test/kafka')]);

    expect(client.lastRequest?.format).toBe('json');
    expect(client.lastRequest?.model).toBe('llama3.1:8b');
    expect(result.summary).toBe('Kafka decouples producers from consumers.');
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.nodes[0]?.sourceId).toBe('https://blog.test/kafka');
    expect(result.graph.edges).toHaveLength(1);
  });

  it('bounds the context window and keeps the model loaded with the default settings', async () => {
    const client = new FakeOllamaChatClient(VALID_JSON);
    const generator = new OllamaStructuredGraphGenerator(client, 'llama3.1:8b');

    await generator.generate('What is Kafka?', [context('https://blog.test/kafka')]);

    expect(client.lastRequest?.options).toEqual({
      temperature: 0,
      num_ctx: DEFAULT_OLLAMA_GENERATION_SETTINGS.contextLength,
    });
    expect(client.lastRequest?.keep_alive).toBe(DEFAULT_OLLAMA_GENERATION_SETTINGS.keepAlive);
  });

  it('sends the configured context window and keep-alive', async () => {
    const client = new FakeOllamaChatClient(VALID_JSON);
    const generator = new OllamaStructuredGraphGenerator(client, 'llama3.1:8b', {
      contextLength: 4096,
      keepAlive: -1,
    });

    await generator.generate('What is Kafka?', [context('https://blog.test/kafka')]);

    expect(client.lastRequest?.options?.num_ctx).toBe(4096);
    expect(client.lastRequest?.keep_alive).toBe(-1);
  });

  it('throws for non-JSON output', async () => {
    const generator = new OllamaStructuredGraphGenerator(
      new FakeOllamaChatClient('not json at all'),
      'llama3.1:8b',
    );

    await expect(generator.generate('q', [context('https://blog.test/x')])).rejects.toBeInstanceOf(
      InvalidStructuredGraphError,
    );
  });
});

describe('parseGeneratedGraph', () => {
  it('throws when the summary is missing', () => {
    expect(() => parseGeneratedGraph(JSON.stringify({ graph: { nodes: [], edges: [] } }))).toThrow(
      InvalidStructuredGraphError,
    );
  });

  it('throws when the graph is malformed', () => {
    expect(() => parseGeneratedGraph(JSON.stringify({ summary: 'x', graph: {} }))).toThrow(
      InvalidStructuredGraphError,
    );
  });

  it('drops malformed nodes and edges referencing unknown nodes', () => {
    const raw = JSON.stringify({
      summary: 'partial',
      graph: {
        nodes: [
          { id: 'a', label: 'A', type: 'concept', source: 'S1' },
          { id: 'b', source: 'S2' }, // malformed: no label
        ],
        edges: [
          { source: 'a', target: 'a', relationship: 'self' },
          { source: 'a', target: 'b', relationship: 'points-to' }, // dangling
        ],
      },
    });

    const result = parseGeneratedGraph(raw);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0]?.id).toBe('a');
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0]?.target).toBe('a');
  });

  it('keeps nodes without a source with a null sourceId', () => {
    const raw = JSON.stringify({
      summary: 'mixed',
      graph: {
        nodes: [
          { id: 'linked', label: 'Linked', type: 'concept', source: 'S1' },
          { id: 'null', label: 'Null', type: 'concept', source: null },
          { id: 'empty', label: 'Empty', type: 'concept', source: '' },
          { id: 'missing', label: 'Missing', type: 'concept' },
        ],
        edges: [{ source: 'linked', target: 'missing', relationship: 'relates to' }],
      },
    });

    const result = parseGeneratedGraph(raw);

    expect(result.graph.nodes.map((node) => [node.id, node.sourceId])).toEqual([
      ['linked', 'S1'],
      ['null', null],
      ['empty', null],
      ['missing', null],
    ]);
    expect(result.graph.edges).toHaveLength(1);
  });

  it('forces the node type to "concept"', () => {
    const raw = JSON.stringify({
      summary: 's',
      graph: {
        nodes: [{ id: 'a', label: 'A', type: 'something-else', source: 'S1' }],
        edges: [],
      },
    });

    expect(parseGeneratedGraph(raw).graph.nodes[0]?.type).toBe('concept');
  });

  it('parses the central node id proposed by the model', () => {
    expect(parseGeneratedGraph(VALID_JSON).graph.centralNodeId).toBe('kafka');
  });

  it('returns a null central node id when the model omits it', () => {
    const raw = JSON.stringify({
      summary: 's',
      graph: {
        nodes: [{ id: 'a', label: 'A', type: 'concept', source: 'S1' }],
        edges: [],
      },
    });

    expect(parseGeneratedGraph(raw).graph.centralNodeId).toBeNull();
  });
});

describe('ollamaGenerationSettingsFromEnv', () => {
  it('falls back to the defaults when the values are missing or blank', () => {
    expect(ollamaGenerationSettingsFromEnv({})).toEqual(DEFAULT_OLLAMA_GENERATION_SETTINGS);
    expect(ollamaGenerationSettingsFromEnv({ contextLength: ' ', keepAlive: '' })).toEqual(
      DEFAULT_OLLAMA_GENERATION_SETTINGS,
    );
  });

  it('parses the context length and a duration keep-alive', () => {
    expect(ollamaGenerationSettingsFromEnv({ contextLength: '4096', keepAlive: '1h' })).toEqual({
      contextLength: 4096,
      keepAlive: '1h',
    });
  });

  it('sends a numeric keep-alive as seconds', () => {
    expect(ollamaGenerationSettingsFromEnv({ keepAlive: '-1' }).keepAlive).toBe(-1);
    expect(ollamaGenerationSettingsFromEnv({ keepAlive: '600' }).keepAlive).toBe(600);
  });

  it.each(['0', '-8', '8.5', 'eight'])('rejects the invalid context length "%s"', (value) => {
    expect(() => ollamaGenerationSettingsFromEnv({ contextLength: value })).toThrow(
      'Invalid Ollama context length',
    );
  });
});
