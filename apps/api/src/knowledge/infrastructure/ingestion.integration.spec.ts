import { Test } from '@nestjs/testing';

import { IngestFeedsCommand } from '../application/ingest-feeds.command';
import {
  ARTICLE_FEED_READER,
  EMBEDDING_GENERATOR,
  FEED_LAST_PUBLICATION_DATE_REPOSITORY,
  FEED_SUBSCRIPTION_READER,
  INGESTION_PROGRESS_REPORTER,
  KNOWLEDGE_CHUNK_REPOSITORY,
  READABLE_ARTICLE_READER,
} from '../application/knowledge.tokens';
import {
  InMemoryFeedLastPublicationDateRepository,
  InMemoryKnowledgeChunkRepository,
  RecordingIngestionProgressReporter,
  StubArticleFeedReader,
  StubEmbeddingGenerator,
  StubFeedSubscriptionReader,
  StubReadableArticleReader,
} from '../application/testing/knowledge-test-doubles';
import { FeedArticleMother, FeedSubscriptionMother } from '../domain/testing/knowledge.mother';
import { KnowledgeModule } from './knowledge.module';

describe('Incremental ingestion wiring', () => {
  it('awaits the real event subscriber and skips indexed posts on a second run', async () => {
    const subscription = FeedSubscriptionMother.create();
    const article = FeedArticleMother.create({ publishedAt: '2026-01-02T00:00:00.000Z' });
    const dates = new InMemoryFeedLastPublicationDateRepository();
    const chunks = new InMemoryKnowledgeChunkRepository();
    const embeddings = new StubEmbeddingGenerator();
    const readable = new StubReadableArticleReader(new Map(), 'sample content');
    const moduleRef = await Test.createTestingModule({ imports: [KnowledgeModule] })
      .overrideProvider(FEED_LAST_PUBLICATION_DATE_REPOSITORY)
      .useValue(dates)
      .overrideProvider(KNOWLEDGE_CHUNK_REPOSITORY)
      .useValue(chunks)
      .overrideProvider(EMBEDDING_GENERATOR)
      .useValue(embeddings)
      .overrideProvider(READABLE_ARTICLE_READER)
      .useValue(readable)
      .overrideProvider(FEED_SUBSCRIPTION_READER)
      .useValue(new StubFeedSubscriptionReader([subscription]))
      .overrideProvider(ARTICLE_FEED_READER)
      .useValue(new StubArticleFeedReader(new Map([[subscription.feedUrl, [article]]])))
      .overrideProvider(INGESTION_PROGRESS_REPORTER)
      .useValue(new RecordingIngestionProgressReporter())
      .compile();
    try {
      await moduleRef.init();
      const command = moduleRef.get(IngestFeedsCommand);
      expect((await command.execute('test.opml')).indexedChunks).toBe(1);
      expect(dates.store.get(subscription.blogName)?.lastPublishedAt).toBe(article.publishedAt);
      expect(await command.execute('test.opml')).toMatchObject({
        indexedChunks: 0,
        processedArticles: 0,
        skippedArticles: 1,
        issues: [],
      });
      expect(readable.calls).toEqual([article.url]);
      expect(embeddings.prompts).toHaveLength(1);
      expect(dates.findAllCalls).toBe(2);
      expect((await command.execute('test.opml', { full: true })).indexedChunks).toBe(1);
      expect(dates.findAllCalls).toBe(2);
      expect(chunks.store.size).toBe(1);
    } finally {
      await moduleRef.close();
    }
  });
});
