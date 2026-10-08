import { IngestFeedsCommand } from './ingest-feeds.command';
import {
  InMemoryKnowledgeChunkRepository,
  InMemoryFeedLastPublicationDateRepository,
  RecordingEventBus,
  RecordingIngestionProgressReporter,
  StubArticleFeedReader,
  StubEmbeddingGenerator,
  StubFeedSubscriptionReader,
  StubReadableArticleReader,
} from './testing/knowledge-test-doubles';
import type { KnowledgeIngestionCompleted } from '../domain/events/knowledge-ingestion-completed';
import type { KnowledgeIngestionFailed } from '../domain/events/knowledge-ingestion-failed';
import type { KnowledgeFeedIngested } from '../domain/events/knowledge-feed-ingested';
import type { FeedLastPublicationDate } from '../domain/feed-last-publication-date';
import type { FeedArticle } from '../domain/article-feed-reader';
import type { FeedSubscription } from '../domain/feed-subscription-reader';
import { chunkText } from '../domain/text-chunker';
import { FeedArticleMother, FeedSubscriptionMother } from '../domain/testing/knowledge.mother';

const OPML_PATH = 'feeds/engineering_blogs_lite.opml';
const EMBEDDING = [0.11, 0.22, 0.33];

interface Scenario {
  subscriptions: FeedSubscription[];
  articlesByFeedUrl?: Map<string, FeedArticle[]>;
  failuresByFeedUrl?: Map<string, Error>;
  textByUrl?: Map<string, string>;
  defaultText?: string;
  articleFailuresByUrl?: Map<string, Error>;
  publicationDates?: FeedLastPublicationDate[];
}

function buildCommand(scenario: Scenario): {
  command: IngestFeedsCommand;
  repository: InMemoryKnowledgeChunkRepository;
  eventBus: RecordingEventBus;
  embeddings: StubEmbeddingGenerator;
  progress: RecordingIngestionProgressReporter;
  publicationDates: InMemoryFeedLastPublicationDateRepository;
  readableArticle: StubReadableArticleReader;
} {
  const repository = new InMemoryKnowledgeChunkRepository();
  const eventBus = new RecordingEventBus();
  const embeddings = new StubEmbeddingGenerator(EMBEDDING);
  const progress = new RecordingIngestionProgressReporter();
  const publicationDates = new InMemoryFeedLastPublicationDateRepository(scenario.publicationDates);
  const readableArticle = new StubReadableArticleReader(
    scenario.textByUrl,
    scenario.defaultText,
    scenario.articleFailuresByUrl,
  );
  const command = new IngestFeedsCommand(
    new StubFeedSubscriptionReader(scenario.subscriptions),
    new StubArticleFeedReader(scenario.articlesByFeedUrl, scenario.failuresByFeedUrl),
    readableArticle,
    embeddings,
    repository,
    eventBus,
    progress,
    publicationDates,
  );

  return { command, repository, eventBus, embeddings, progress, publicationDates, readableArticle };
}

describe('IngestFeedsCommand', () => {
  it('stores post source metadata using the article URL as identity', async () => {
    const subscription = FeedSubscriptionMother.create();
    const article = FeedArticleMother.create();
    const scenario = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      defaultText: 'indexed content',
    });

    await scenario.command.execute(OPML_PATH);

    expect([...scenario.repository.store.values()][0]?.metadata).toMatchObject({
      sourceType: 'post',
      sourceId: article.url,
      articleUrl: article.url,
    });
  });

  it('loads dates once and skips old posts before extraction or embedding', async () => {
    const subscription = FeedSubscriptionMother.create();
    const old = FeedArticleMother.create({ publishedAt: '2026-01-01T00:00:00Z' });
    const scenario = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [old]]]),
      publicationDates: [
        { blogName: subscription.blogName, lastPublishedAt: old.publishedAt ?? '' },
      ],
      defaultText: 'old content',
    });
    const result = await scenario.command.execute(OPML_PATH);
    expect(result).toMatchObject({
      processedArticles: 0,
      skippedArticles: 1,
      indexedChunks: 0,
      issues: [],
    });
    expect(scenario.publicationDates.findAllCalls).toBe(1);
    expect(scenario.readableArticle.calls).toEqual([]);
    expect(scenario.embeddings.documentBatches).toEqual([]);
    expect(scenario.repository.upsertCalls).toEqual([]);
    expect(scenario.eventBus.ofType('knowledge.feed.ingested')).toEqual([]);
  });

  it('emits one event after storing a feed, using only dates of indexed posts', async () => {
    const subscription = FeedSubscriptionMother.create();
    const articles = [
      FeedArticleMother.create({ publishedAt: '2026-01-01T00:00:00Z' }),
      FeedArticleMother.create({ publishedAt: '2026-01-03T00:00:00Z' }),
      FeedArticleMother.create({ publishedAt: '2026-01-02T00:00:00Z' }),
    ];
    const scenario = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, articles]]),
      defaultText: 'indexed content',
      textByUrl: new Map([[articles[1]!.url, '']]),
    });
    const publish = jest.spyOn(scenario.eventBus, 'publish');
    publish.mockImplementation(async (events): Promise<void> => {
      if (events.some((event) => event.eventName === 'knowledge.feed.ingested')) {
        expect(scenario.repository.store.size).toBe(2);
      }
      scenario.eventBus.published.push(...events);
    });
    await scenario.command.execute(OPML_PATH);
    const events = scenario.eventBus.ofType<KnowledgeFeedIngested>('knowledge.feed.ingested');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      blogName: subscription.blogName,
      lastPublishedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(scenario.readableArticle.calls).toEqual([
      articles[1]!.url,
      articles[2]!.url,
      articles[0]!.url,
    ]);
  });

  it('does not advance a publication date if Chroma storage fails', async () => {
    const subscription = FeedSubscriptionMother.create();
    const scenario = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [FeedArticleMother.create()]]]),
      defaultText: 'content',
    });
    scenario.repository.failure = new Error('Chroma unavailable');
    const result = await scenario.command.execute(OPML_PATH);
    expect(result.processedFeeds).toBe(0);
    expect(result.indexedChunks).toBe(0);
    expect(scenario.eventBus.ofType('knowledge.feed.ingested')).toEqual([]);
    expect(result.issues[0]?.reason).toBe('Chroma unavailable');
  });

  it('reingests everything with --full without loading the saved snapshot', async () => {
    const subscription = FeedSubscriptionMother.create();
    const article = FeedArticleMother.create({ publishedAt: '2026-01-01T00:00:00Z' });
    const scenario = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      publicationDates: [
        { blogName: subscription.blogName, lastPublishedAt: '2026-02-01T00:00:00Z' },
      ],
      defaultText: 'content',
    });
    expect((await scenario.command.execute(OPML_PATH, { full: true })).indexedChunks).toBe(1);
    expect(scenario.publicationDates.findAllCalls).toBe(0);
    expect(scenario.eventBus.ofType('knowledge.feed.ingested')).toHaveLength(1);
  });

  it('always ingests undated posts without saving an invented publication date', async () => {
    const subscription = FeedSubscriptionMother.create();
    const scenario = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([
        [subscription.feedUrl, [FeedArticleMother.create({ publishedAt: null })]],
      ]),
      defaultText: 'undated content',
    });
    await scenario.command.execute(OPML_PATH);
    expect(scenario.repository.lastUpsert[0]?.metadata).toMatchObject({ publishedAt: '' });
    expect(scenario.eventBus.ofType('knowledge.feed.ingested')).toEqual([]);
  });

  it('fully ingests ambiguous blog names without reading or advancing their cursor', async () => {
    const first = FeedSubscriptionMother.create({ blogName: 'Shared name' });
    const second = FeedSubscriptionMother.create({ blogName: 'Shared name' });
    const scenario = buildCommand({
      subscriptions: [first, second],
      publicationDates: [{ blogName: first.blogName, lastPublishedAt: '2027-01-01T00:00:00Z' }],
      articlesByFeedUrl: new Map([
        [first.feedUrl, [FeedArticleMother.create({ publishedAt: '2026-01-01T00:00:00Z' })]],
        [second.feedUrl, [FeedArticleMother.create({ publishedAt: '2026-01-02T00:00:00Z' })]],
      ]),
      defaultText: 'content',
    });
    const result = await scenario.command.execute(OPML_PATH);
    expect(result.indexedChunks).toBe(2);
    expect(scenario.repository.upsertCalls).toHaveLength(2);
    expect(result.issues.map((issue) => issue.type)).toEqual([
      'ambiguous-origin',
      'ambiguous-origin',
    ]);
    expect(scenario.eventBus.ofType('knowledge.feed.ingested')).toEqual([]);
  });

  it('fails before fetching RSS when the initial PostgreSQL read fails', async () => {
    const scenario = buildCommand({ subscriptions: [FeedSubscriptionMother.create()] });
    jest
      .spyOn(scenario.publicationDates, 'findAll')
      .mockRejectedValue(new Error('PostgreSQL unavailable'));
    await expect(scenario.command.execute(OPML_PATH)).rejects.toThrow('PostgreSQL unavailable');
    expect(scenario.progress.reports).toEqual([]);
  });

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
    expect(repository.lastUpsert[0]?.metadata).toMatchObject({
      blogName: subscription.blogName,
      articleUrl: article.url,
    });
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
    const { command, repository } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'embed this content']]),
    });

    await command.execute(OPML_PATH);

    expect(repository.lastUpsert[0]?.embedding).toEqual(EMBEDDING);
  });

  it('embeds every chunk as a document, without the article title', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({
      url: 'https://blog.test/kafka',
      title: 'Running Kafka at scale',
    });
    const { command, embeddings } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'Partitions spread the load across brokers.']]),
    });

    await command.execute(OPML_PATH);

    expect(embeddings.documents).toEqual(['Partitions spread the load across brokers.']);
    expect(embeddings.queries).toEqual([]);
  });

  it('embeds all the chunks of an article in a single request', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const articles = [
      FeedArticleMother.create({
        url: 'https://blog.test/long',
        publishedAt: '2026-01-02T00:00:00Z',
      }),
      FeedArticleMother.create({
        url: 'https://blog.test/short',
        publishedAt: '2026-01-01T00:00:00Z',
      }),
    ];
    const longText = Array.from({ length: 800 }, (_, index) => `word${index}`).join(' ');
    const { command, embeddings } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, articles]]),
      textByUrl: new Map([
        [articles[0]!.url, longText],
        [articles[1]!.url, 'short content'],
      ]),
    });

    await command.execute(OPML_PATH);

    expect(embeddings.documentBatches.map((batch) => batch.length)).toEqual([
      chunkText(longText).length,
      1,
    ]);
  });

  it('does not request embeddings for an article without readable text', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const { command, embeddings } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [FeedArticleMother.create()]]]),
      defaultText: '',
    });

    await command.execute(OPML_PATH);

    expect(embeddings.documentBatches).toEqual([]);
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
        totals: { articles: 2, chunks: 2, skippedArticles: 0 },
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

  it('collects an inaccessible feed as an issue and keeps processing the rest', async () => {
    const healthy = FeedSubscriptionMother.create({ feedUrl: 'https://ok.test/feed' });
    const broken = FeedSubscriptionMother.create({ feedUrl: 'https://broken.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://ok.test/post-1' });
    const { command } = buildCommand({
      subscriptions: [healthy, broken],
      articlesByFeedUrl: new Map([[healthy.feedUrl, [article]]]),
      failuresByFeedUrl: new Map([[broken.feedUrl, new Error('feed unreachable')]]),
      textByUrl: new Map([[article.url, 'healthy content']]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedFeeds).toBe(1);
    expect(result.issues).toEqual([
      {
        blogName: broken.blogName,
        feedUrl: broken.feedUrl,
        type: 'inaccessible',
        reason: 'feed unreachable',
      },
    ]);
  });

  it('collects a feed with no RSS entries as an empty issue', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://empty.test/feed' });
    const { command } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, []]]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedFeeds).toBe(1);
    expect(result.indexedChunks).toBe(0);
    expect(result.issues).toEqual([
      {
        blogName: subscription.blogName,
        feedUrl: subscription.feedUrl,
        type: 'empty',
        reason: 'No articles found in the RSS feed',
      },
    ]);
  });

  it('collects a feed whose articles have no readable text as an empty issue', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const articles = [
      FeedArticleMother.create({ url: 'https://blog.test/paywalled-1' }),
      FeedArticleMother.create({ url: 'https://blog.test/paywalled-2' }),
    ];
    const { command } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, articles]]),
      defaultText: '',
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedArticles).toBe(2);
    expect(result.indexedChunks).toBe(0);
    expect(result.issues).toEqual([
      {
        blogName: subscription.blogName,
        feedUrl: subscription.feedUrl,
        type: 'empty',
        reason: 'No readable content extracted from 2 article(s)',
      },
    ]);
  });

  it('reports no issue for a feed that indexes at least one chunk', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const { command } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'healthy content']]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.issues).toEqual([]);
  });

  it('ingests a feed URL repeated in the OPML once and reports the repetition as a duplicate', async () => {
    const facebook = FeedSubscriptionMother.create({
      blogName: 'Facebook',
      feedUrl: 'https://engineering.fb.com/feed/',
    });
    const facebookAi = FeedSubscriptionMother.create({
      blogName: 'Facebook AI Research',
      feedUrl: 'https://engineering.fb.com/feed/',
    });
    const article = FeedArticleMother.create({ url: 'https://engineering.fb.com/post-1' });
    const { command, repository, progress } = buildCommand({
      subscriptions: [facebook, facebookAi],
      articlesByFeedUrl: new Map([[facebook.feedUrl, [article]]]),
      textByUrl: new Map([[article.url, 'facebook content']]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedFeeds).toBe(1);
    expect(repository.lastUpsert.map((chunk) => chunk.metadata)).toEqual([
      expect.objectContaining({ blogName: 'Facebook' }),
    ]);
    expect(progress.reports.filter((report) => report.status === 'in progress')).toHaveLength(1);
    expect(result.issues).toEqual([
      {
        blogName: 'Facebook AI Research',
        feedUrl: 'https://engineering.fb.com/feed/',
        type: 'duplicate',
        reason: 'Same feed URL as "Facebook", which is ingested instead',
      },
    ]);
  });

  it('ingests an article shared by two feeds once, without reporting the second feed as empty', async () => {
    const first = FeedSubscriptionMother.create({ feedUrl: 'https://first.test/feed' });
    const second = FeedSubscriptionMother.create({ feedUrl: 'https://second.test/feed' });
    const shared = FeedArticleMother.create({ url: 'https://shared.test/cross-post' });
    const { command, repository } = buildCommand({
      subscriptions: [first, second],
      articlesByFeedUrl: new Map([
        [first.feedUrl, [shared]],
        [second.feedUrl, [shared]],
      ]),
      textByUrl: new Map([[shared.url, 'shared content']]),
    });

    const result = await command.execute(OPML_PATH);

    const ids = repository.lastUpsert.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.processedArticles).toBe(1);
    expect(result.indexedChunks).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it('ingests an article listed twice in the same feed once', async () => {
    const subscription = FeedSubscriptionMother.create({ feedUrl: 'https://blog.test/feed' });
    const article = FeedArticleMother.create({ url: 'https://blog.test/post-1' });
    const { command, repository } = buildCommand({
      subscriptions: [subscription],
      articlesByFeedUrl: new Map([[subscription.feedUrl, [article, article]]]),
      textByUrl: new Map([[article.url, 'listed twice']]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.processedArticles).toBe(1);
    expect(repository.lastUpsert).toHaveLength(1);
  });

  it('still ingests a shared article through a later feed when the first feed fails halfway', async () => {
    const failing = FeedSubscriptionMother.create({ feedUrl: 'https://failing.test/feed' });
    const healthy = FeedSubscriptionMother.create({ feedUrl: 'https://ok.test/feed' });
    const shared = FeedArticleMother.create({ url: 'https://shared.test/cross-post' });
    const unreachable = FeedArticleMother.create({ url: 'https://failing.test/unreachable' });
    const { command, repository } = buildCommand({
      subscriptions: [failing, healthy],
      articlesByFeedUrl: new Map([
        [failing.feedUrl, [shared, unreachable]],
        [healthy.feedUrl, [shared]],
      ]),
      defaultText: 'shared content',
      articleFailuresByUrl: new Map([[unreachable.url, new Error('article unreachable')]]),
    });

    const result = await command.execute(OPML_PATH);

    expect(result.issues.map((issue) => [issue.feedUrl, issue.type])).toEqual([
      [failing.feedUrl, 'inaccessible'],
    ]);
    expect(repository.lastUpsert.map((chunk) => chunk.metadata)).toEqual([
      expect.objectContaining({ articleUrl: shared.url, blogName: healthy.blogName }),
    ]);
  });
});
