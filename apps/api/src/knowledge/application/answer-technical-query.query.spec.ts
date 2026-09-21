import { AnswerTechnicalQueryQuery, TECHNICAL_QUERY_TOP_K } from './answer-technical-query.query';
import {
  InMemoryKnowledgeChunkRepository,
  StubEmbeddingGenerator,
} from './testing/knowledge-test-doubles';
import { KnowledgeChunkMother } from '../domain/testing/knowledge.mother';
import type { KnowledgeSearchMatch } from '../domain/knowledge-chunk-repository';

function match(
  overrides?: Parameters<typeof KnowledgeChunkMother.create>[0],
  score = 0.9,
): KnowledgeSearchMatch {
  return { chunk: KnowledgeChunkMother.create(overrides), score };
}

function buildQuery(matches: KnowledgeSearchMatch[]): {
  query: AnswerTechnicalQueryQuery;
  embeddings: StubEmbeddingGenerator;
  repository: InMemoryKnowledgeChunkRepository;
} {
  const embeddings = new StubEmbeddingGenerator([0.5, 0.5]);
  const repository = new InMemoryKnowledgeChunkRepository();
  repository.matches = matches;
  const query = new AnswerTechnicalQueryQuery(embeddings, repository);
  return { query, embeddings, repository };
}

describe('AnswerTechnicalQueryQuery', () => {
  it('embeds the question once and searches the store with the configured Top-K', async () => {
    const { query, embeddings, repository } = buildQuery([match()]);

    await query.execute('How does Netflix scale its API?');

    expect(embeddings.prompts).toEqual(['How does Netflix scale its API?']);
    expect(repository.searchCalls).toHaveLength(1);
    expect(repository.searchCalls[0]?.embedding).toEqual([0.5, 0.5]);
    expect(repository.searchCalls[0]?.limit).toBe(TECHNICAL_QUERY_TOP_K);
  });

  it('returns the retrieved chunks preserving their source URLs and score', async () => {
    const { query } = buildQuery([
      match(
        {
          document: 'Netflix uses a federated gateway.',
          articleTitle: 'Scaling the API',
          articleUrl: 'https://netflixtechblog.com/scaling-the-api',
          blogName: 'Netflix Tech Blog',
        },
        0.87,
      ),
    ]);

    const response = await query.execute('api scaling');

    expect(response.chunks).toEqual([
      {
        document: 'Netflix uses a federated gateway.',
        articleTitle: 'Scaling the API',
        articleUrl: 'https://netflixtechblog.com/scaling-the-api',
        blogName: 'Netflix Tech Blog',
        score: 0.87,
      },
    ]);
  });

  it('returns an empty list when nothing matches', async () => {
    const { query } = buildQuery([]);

    const response = await query.execute('an unknown topic');

    expect(response.chunks).toEqual([]);
  });
});
