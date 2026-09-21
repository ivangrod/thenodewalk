import {
  InvalidStructuredGraphError,
  OllamaStructuredGraphGenerator,
  parseGeneratedGraph,
  type OllamaChatClient,
} from './ollama-structured-graph-generator';
import { KnowledgeChunkMother } from '../../domain/testing/knowledge.mother';
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
      { id: 'kafka', label: 'Apache Kafka', type: 'concept', sourceUrl: 'https://blog.test/kafka' },
      { id: 'broker', label: 'Broker', type: 'concept', sourceUrl: 'https://blog.test/kafka' },
    ],
    edges: [{ source: 'kafka', target: 'broker', relationship: 'contains' }],
  },
});

describe('OllamaStructuredGraphGenerator', () => {
  it('requests JSON output and parses it into the domain graph preserving sourceUrl', async () => {
    const client = new FakeOllamaChatClient(VALID_JSON);
    const generator = new OllamaStructuredGraphGenerator(client, 'llama3.1:8b');

    const result = await generator.generate('What is Kafka?', [context('https://blog.test/kafka')]);

    expect(client.lastRequest?.format).toBe('json');
    expect(client.lastRequest?.model).toBe('llama3.1:8b');
    expect(result.summary).toBe('Kafka decouples producers from consumers.');
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.nodes[0]?.sourceUrl).toBe('https://blog.test/kafka');
    expect(result.graph.edges).toHaveLength(1);
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
          { id: 'a', label: 'A', type: 'concept', sourceUrl: 'https://blog.test/a' },
          { id: 'b', label: 'B' }, // malformed: no sourceUrl
        ],
        edges: [
          { source: 'a', target: 'a', relationship: 'self' },
          { source: 'a', target: 'missing', relationship: 'points-to' }, // dangling
        ],
      },
    });

    const result = parseGeneratedGraph(raw);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0]?.id).toBe('a');
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0]?.target).toBe('a');
  });

  it('forces the node type to "concept"', () => {
    const raw = JSON.stringify({
      summary: 's',
      graph: {
        nodes: [{ id: 'a', label: 'A', type: 'something-else', sourceUrl: 'https://blog.test/a' }],
        edges: [],
      },
    });

    expect(parseGeneratedGraph(raw).graph.nodes[0]?.type).toBe('concept');
  });
});
