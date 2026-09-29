import { IngestFeedsCommand } from './ingest-feeds.command';
import {
  InMemoryKnowledgeChunkRepository,
  RecordingEventBus,
  RecordingIngestionProgressReporter,
  StubArticleFeedReader,
  StubEmbeddingGenerator,
  StubFeedSubscriptionReader,
  StubReadableArticleReader,
} from './testing/knowledge-test-doubles';
import type { KnowledgeIngestionCompleted } from '../domain/events/knowledge-ingestion-completed';
import type { KnowledgeIngestionFailed } from '../domain/events/knowledge-ingestion-failed';
import type { FeedArticle } from '../domain/article-feed-reader';
import type { FeedSubscription } from '../domain/feed-subscription-reader';
import { chunkText } from '../domain/text-chunker';
import { FeedArticleMother, FeedSubscriptionMother } from '../domain/testing/knowledge.mother';

const OPML_PATH = 'feeds/engineering_blogs.opml';
const EMBEDDING = [0.11, 0.22, 0.33];

interface Scenario {
  subscriptions: FeedSubscription[];
  articlesByFeedUrl?: Map<string, FeedArticle[]>;
  failuresByFeedUrl?: Map<string, Error>;
  textByUrl?: Map<string, string>;
  defaultText?: string;
}

function buildCommand(scenario: Scenario): {
  command: IngestFeedsCommand;
  repository: InMemoryKnowledgeChunkRepository;
  eventBus: RecordingEventBus;
  embeddings: StubEmbeddingGenerator;
  progress: RecordingIngestionProgressReporter;
} {
  const repository = new InMemoryKnowledgeChunkRepository();
  const eventBus = new RecordingEventBus();
  const embeddings = new StubEmbeddingGenerator(EMBEDDING);
  const progress = new RecordingIngestionProgressReporter();
  const command = new IngestFeedsCommand(
    new StubFeedSubscriptionReader(scenario.subscriptions),
    new StubArticleFeedReader(scenario.articlesByFeedUrl, scenario.failuresByFeedUrl),
    new StubReadableArticleReader(scenario.textByUrl, scenario.defaultText),
    embeddings,
    repository,
    eventBus,
    progress,
  );

  return { command, repository, eventBus, embeddings, progress };
}

describe('IngestFeedsCommand', () => {
  it('parses OPML feeds and processes every subscribed article', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const { command, repository } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'hello world from the engineering blog']]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedFeeds).toBe(1);
    expect(result.processedArticles).toBe(1);
    expect(result.indexedChunks).toBe(1);
    expect(repository.lastUpsert[0]?.metadata.blogName).toBe(subscription.blogName);
    expect(repository.lastUpsert[0]?.metadata.articleUrl).toBe(article.url);
  });

  it('indexes the readable text of the article as the chunk document', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const { command, repository } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'clean readable content']]),
    });

    await command.execute(OPML_PATH);

    expect(repository.lastUpsert[0]?.document).toBe('clean readable content');
  });

  it('splits long articles into several chunks', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/long' });
    const longText = Array.from({ length: 800 }, (_, index) => `word${index}`).join(' ');
    const expectedChunks = chunkText(longText).length;
    const { command, repository } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, longText]]),
    });

    const result = await command.execute(OPML_PATH);

    expect(expectedChunks).toBeGreaterThan(1);
    expect(result.indexedChunks).toBe(expectedChunks);
    expect(repository.lastUpsert).toHaveLength(expectedChunks);
  });

  it('upserts every chunk with its generated embedding', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const { command, repository, embeddings } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'embed this content']]),
    });

    await command.execute(OPML_PATH);

    expect(repository.lastUpsert[0]?.embedding).toEqual(EMBEDDING);
    expect(embeddings.prompts).toContain('embed this content');
  });

  it('is idempotent on re-run: the same article yields the same chunk ids', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const scenario: Scenario = {
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'stable deterministic content']]),
    };

    const first = buildCommand(scenario);
    await first.command.execute(OPML_PATH);
    const firstIds = first.repository.lastUpsert.map((chunk) => chunk.id);

    const second = buildCommand(scenario);
    await second.command.execute(OPML_PATH);
    const secondIds = second.repository.lastUpsert.map((chunk) => chunk.id);

    expect(secondIds).toEqual(firstIds);
    expect(second.repository.store.size).toBe(firstIds.length);
  });

  it('emits KnowledgeIngestionCompleted with the run totals', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const { command, eventBus } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'some content']]),
    });

    const result = await command.execute(OPML_PATH);

    const completed = eventBus.ofType<KnowledgeIngestionCompleted>('knowledge.ingestion.completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      processedFeeds: result.processedFeeds,
      processedArticles: result.processedArticles,
      indexedChunks: result.indexedChunks,
    });
    expect(typeof completed[0]?.occurredAt).toBe('string');
  });

  it('emits KnowledgeIngestionFailed for a failing feed and keeps processing the rest', async () => {
    const healthy = FeedSubscriptionMother.create({ feedUrl: 'https://ok.test/feed' });
    const broken = FeedSubscriptionMother.create({ feedUrl: 'https://broken.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://ok.test/post-1' });
    const { command, eventBus } = buildCommand({
      subscriptions: [healthy, broken],
      articlesByFeedUrl: new Map([[healthy.feedUrl, [article]]]),
      failuresByFeedUrl: new Map([[broken.feedUrl, new Error('feed unreachable')]]),
      textByUrl: new Map([[article.url, 'healthy content']]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedFeeds).toBe(1);
    const failures = eventBus.ofType<KnowledgeIngestionFailed>('knowledge.ingestion.failed');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      feedUrl: broken.feedUrl,
      reason: 'feed unreachable',
    });
    expect(eventBus.ofType('knowledge.ingestion.completed')).toHaveLength(1);
  });

  it('reports every feed as in progress with its position before ingesting it', async () => {
    const first = FeedSubscriptionMother.create({ feedUrl: 'https://first.test/feed' });
    const second = FeedSubscriptionMother.create({ feedUrl: 'https://second.test/feed' });
    const { command, progress } = buildCommand({ subscriptions: [first, second] });

    await command.execute(OPML_PATH);

    const started = progress.reports.filter((report) => report.status === 'in progress');
    expect(started.map((report) => report.progress)).toEqual([
      { position: 1, total: 2, blogName: first.blogName, feedUrl: first.feedUrl },
      { position: 2, total: 2, blogName: second.blogName, feedUrl: second.feedUrl },
    ]);
    expect(progress.reports[0]?.status).toBe('in progress');
  });

  it('reports a feed as completed with its article and chunk totals', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const articles = [
      FeedArticleMother.create({ url: 'https://blog.test/post-1' }),
      FeedArticleMother.create({ url: 'https://blog.test/post-2' }),
    ];
    const { command, progress } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, articles]]),
      defaultText: 'short article content',
    });

    await command.execute(OPML_PATH);

    expect(progress.reports).toEqual([
      {
        status: 'in progress',
        progress: {
          position: 1,
          total: 1,
          blogName: subscription.blogName,
          feedUrl: subscription.feedUrl,
        },
      },
      {
        status: 'completed',
        progress: {
          position: 1,
          total: 1,
          blogName: subscription.blogName,
          feedUrl: subscription.feedUrl,
        },
        totals: { articles: 2, chunks: 2 },
      },
    ]);
  });

  it('reports a failed feed and keeps reporting the remaining ones', async () => {
    const broken = FeedSubscriptionMother.create({ feedUrl: 'https://broken.test/feed' });
    const healthy = FeedSubscriptionMother.create({ feedUrl: 'https://ok.test/feed' });
    const { command, progress } = buildCommand({
      subscriptions: [broken, healthy],
      failuresByFeedUrl: new Map([[broken.feedUrl, new Error('feed unreachable')]]),
    });

    await command.execute(OPML_PATH);

    expect(progress.reports.map((report) => [report.status, report.progress.position])).toEqual([
      ['in progress', 1],
      ['failed', 1],
      ['in progress', 2],
      ['completed', 2],
    ]);
    expect(progress.reports[1]).toMatchObject({ status: 'failed', reason: 'feed unreachable' });
  });
});
