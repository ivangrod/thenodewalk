import { resolve } from 'node:path';

import { Test } from '@nestjs/testing';

import { IngestBooksCommand } from '../../application/ingest-books.command';
import { AnswerTechnicalQueryQuery } from '../../application/answer-technical-query.query';
import {
  EMBEDDING_GENERATOR,
  FEED_LAST_PUBLICATION_DATE_REPOSITORY,
  KNOWLEDGE_CHUNK_REPOSITORY,
  STRUCTURED_GRAPH_GENERATOR,
} from '../../application/knowledge.tokens';
import {
  InMemoryFeedLastPublicationDateRepository,
  InMemoryKnowledgeChunkRepository,
  StubEmbeddingGenerator,
  StubStructuredGraphGenerator,
} from '../../application/testing/knowledge-test-doubles';
import { KnowledgeModule } from '../knowledge.module';

describe('book ingestion to query (integration)', () => {
  it('wires EPUB/PDF readers and returns a traceable PDF chapter with a page reference', async () => {
    const repository = new InMemoryKnowledgeChunkRepository();
    const generator = new StubStructuredGraphGenerator();
    const context = await Test.createTestingModule({ imports: [KnowledgeModule] })
      .overrideProvider(FEED_LAST_PUBLICATION_DATE_REPOSITORY)
      .useValue(new InMemoryFeedLastPublicationDateRepository())
      .overrideProvider(KNOWLEDGE_CHUNK_REPOSITORY)
      .useValue(repository)
      .overrideProvider(EMBEDDING_GENERATOR)
      .useValue(new StubEmbeddingGenerator([0.1, 0.2]))
      .overrideProvider(STRUCTURED_GRAPH_GENERATOR)
      .useValue(generator)
      .compile();
    await context.init();
    try {
      const result = await context
        .get(IngestBooksCommand)
        .execute(resolve(__dirname, '../../../../test/fixtures/books'));
      expect(result.indexedChunks).toBe(3);
      const chunk = [...repository.store.values()].find(
        ({ metadata }) => metadata.sourceType === 'book' && metadata.format === 'pdf',
      )!;
      repository.matches = [{ chunk, score: 0.9 }];
      generator.result = {
        summary: 'Use short feedback loops',
        graph: {
          nodes: [
            {
              id: 'feedback',
              label: 'Feedback',
              type: 'concept',
              sourceId: chunk.metadata.sourceId,
            },
          ],
          edges: [],
          centralNodeId: 'feedback',
        },
      };
      const answer = await context
        .get(AnswerTechnicalQueryQuery)
        .execute('How can reviews improve?');
      expect(answer.graph.nodes[0]?.source).toEqual({
        kind: 'book',
        bookTitle: 'Sample Engineering Book',
        sectionTitle: 'Small feedback loops',
        pageStart: 1,
      });
    } finally {
      await context.close();
    }
  });
});
