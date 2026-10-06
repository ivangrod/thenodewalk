import {
  embeddingTaskPrefixesFor,
  OllamaEmbeddingGenerator,
  type OllamaEmbedClient,
} from './ollama-embedding-generator';

type EmbedRequest = Parameters<OllamaEmbedClient['embed']>[0];

class FakeOllamaEmbedClient implements OllamaEmbedClient {
  readonly requests: EmbedRequest[] = [];

  constructor(private readonly respond?: (input: string[]) => number[][]) {}

  embed(request: EmbedRequest): Promise<{ embeddings: number[][] }> {
    this.requests.push(request);
    const embeddings = this.respond
      ? this.respond(request.input)
      : request.input.map((_, index) => [index, 1]);
    return Promise.resolve({ embeddings });
  }
}

describe('OllamaEmbeddingGenerator', () => {
  it('embeds documents in one /api/embed request with the document prefix of nomic-embed-text', async () => {
    const client = new FakeOllamaEmbedClient();
    const generator = new OllamaEmbeddingGenerator(client, 'nomic-embed-text');

    const embeddings = await generator.embedDocuments(['first chunk', 'second chunk']);

    expect(client.requests).toEqual([
      {
        model: 'nomic-embed-text',
        input: ['search_document: first chunk', 'search_document: second chunk'],
        truncate: true,
      },
    ]);
    expect(embeddings).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('embeds a query with the query prefix of nomic-embed-text', async () => {
    const client = new FakeOllamaEmbedClient(() => [[0.6, 0.8]]);
    const generator = new OllamaEmbeddingGenerator(client, 'nomic-embed-text:latest');

    const embedding = await generator.embedQuery('Is Kafka a good fit for event-driven systems?');

    expect(client.requests[0]?.input).toEqual([
      'search_query: Is Kafka a good fit for event-driven systems?',
    ]);
    expect(embedding).toEqual([0.6, 0.8]);
  });

  it('embeds raw text with a model that has no known task prefixes', async () => {
    const client = new FakeOllamaEmbedClient();
    const generator = new OllamaEmbeddingGenerator(client, 'all-minilm');

    await generator.embedDocuments(['a chunk']);
    await generator.embedQuery('a question');

    expect(client.requests.map((request) => request.input)).toEqual([['a chunk'], ['a question']]);
  });

  it('does not call Ollama for an empty batch of documents', async () => {
    const client = new FakeOllamaEmbedClient();
    const generator = new OllamaEmbeddingGenerator(client, 'nomic-embed-text');

    expect(await generator.embedDocuments([])).toEqual([]);
    expect(client.requests).toEqual([]);
  });

  it('fails when Ollama returns a different number of embeddings than texts', async () => {
    const client = new FakeOllamaEmbedClient(() => [[0.1]]);
    const generator = new OllamaEmbeddingGenerator(client, 'nomic-embed-text');

    await expect(generator.embedDocuments(['first', 'second'])).rejects.toThrow(
      'Ollama returned 1 embeddings for 2 texts with model nomic-embed-text',
    );
  });
});

describe('embeddingTaskPrefixesFor', () => {
  it('resolves nomic-embed-text with or without a tag', () => {
    const nomic = { document: 'search_document: ', query: 'search_query: ' };

    expect(embeddingTaskPrefixesFor('nomic-embed-text')).toEqual(nomic);
    expect(embeddingTaskPrefixesFor('nomic-embed-text:v1.5')).toEqual(nomic);
  });

  it('only prefixes queries for mxbai-embed-large', () => {
    expect(embeddingTaskPrefixesFor('mxbai-embed-large')).toEqual({
      document: '',
      query: 'Represent this sentence for searching relevant passages: ',
    });
  });

  it('uses no prefixes for unknown models', () => {
    expect(embeddingTaskPrefixesFor('all-minilm:latest')).toEqual({ document: '', query: '' });
  });
});
