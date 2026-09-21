import { AnswerTechnicalQueryQuery, TECHNICAL_QUERY_TOP_K } from './answer-technical-query.query';
import {
  InMemoryKnowledgeChunkRepository,
  StubEmbeddingGenerator,
  StubStructuredGraphGenerator,
} from './testing/knowledge-test-doubles';
import { KnowledgeChunkMother } from '../domain/testing/knowledge.mother';
import type { KnowledgeSearchMatch } from '../domain/knowledge-chunk-repository';
import type { GeneratedGraph } from '../domain/knowledge-graph';

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

  it('returns an empty graph and an explanatory summary when nothing is retrieved', async () => {
    const { query, generator } = buildQuery([]);

    const response = await query.execute('an unknown topic');

    expect(response.graph).toEqual({ nodes: [], edges: [] });
    expect(response.summary.length).toBeGreaterThan(0);
    expect(generator.calls).toHaveLength(0);
  });

  it('surfaces a safe response when structured generation fails', async () => {
    const { query, generator } = buildQuery([matchWith('https://blog.test/post')]);
    generator.error = new Error('model returned garbage');

    const response = await query.execute('a question');

    expect(response.graph).toEqual({ nodes: [], edges: [] });
    expect(response.summary.length).toBeGreaterThan(0);
  });
});
