import type { EventBus } from '../../../shared/domain/event-bus';
import type { DomainEvent } from '../../../shared/domain/domain-event';
import type { ArticleFeedReader, FeedArticle } from '../../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../../domain/embedding-generator';
import type {
  FeedSubscription,
  FeedSubscriptionReader,
} from '../../domain/feed-subscription-reader';
import type {
  FeedIngestionProgress,
  IngestionProgressReporter,
} from '../../domain/ingestion-progress-reporter';
import type { KnowledgeChunk } from '../../domain/knowledge-chunk';
import type {
  KnowledgeChunkRepository,
  KnowledgeSearchMatch,
} from '../../domain/knowledge-chunk-repository';
import type { GeneratedGraph } from '../../domain/knowledge-graph';
import { EMPTY_GRAPH } from '../../domain/knowledge-graph';
import type { ReadableArticleReader } from '../../domain/readable-article-reader';
import type { StructuredGraphGenerator } from '../../domain/structured-graph-generator';
import type { FeedLastPublicationDate } from '../../domain/feed-last-publication-date';
import type { FeedLastPublicationDateRepository } from '../../domain/feed-last-publication-date-repository';

export class InMemoryFeedLastPublicationDateRepository
  implements FeedLastPublicationDateRepository
{
  readonly store = new Map<string, FeedLastPublicationDate & { feedUrl: string }>();
  findAllCalls = 0;

  constructor(records: FeedLastPublicationDate[] = []) {
    for (const record of records) this.store.set(record.blogName, { ...record, feedUrl: '' });
  }

  findAll(): Promise<FeedLastPublicationDate[]> {
    this.findAllCalls += 1;
    return Promise.resolve([...this.store.values()]);
  }

  save(record: FeedLastPublicationDate & { feedUrl: string }): Promise<void> {
    const previous = this.store.get(record.blogName);
    if (
      previous === undefined ||
      Date.parse(previous.lastPublishedAt) < Date.parse(record.lastPublishedAt)
    ) {
      this.store.set(record.blogName, record);
    }
    return Promise.resolve();
  }
}

export type FeedProgressReport =
  | { status: 'in progress'; progress: FeedIngestionProgress }
  | {
      status: 'completed';
      progress: FeedIngestionProgress;
      totals: { articles: number; chunks: number; skippedArticles?: number };
    }
  | { status: 'failed'; progress: FeedIngestionProgress; reason: string };

export class StubFeedSubscriptionReader implements FeedSubscriptionReader {
  constructor(private readonly subscriptions: FeedSubscription[] = []) {}

  read(): Promise<FeedSubscription[]> {
    return Promise.resolve(this.subscriptions);
  }
}

export class StubArticleFeedReader implements ArticleFeedReader {
  constructor(
    private readonly articlesByFeedUrl: Map<string, FeedArticle[]> = new Map(),
    private readonly failuresByFeedUrl: Map<string, Error> = new Map(),
  ) {}

  fetchArticles(subscription: FeedSubscription): Promise<FeedArticle[]> {
    const failure = this.failuresByFeedUrl.get(subscription.feedUrl);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    return Promise.resolve(this.articlesByFeedUrl.get(subscription.feedUrl) ?? []);
  }
}

export class StubReadableArticleReader implements ReadableArticleReader {
  readonly calls: string[] = [];
  constructor(
    private readonly textByUrl: Map<string, string> = new Map(),
    private readonly defaultText = '',
    private readonly failuresByUrl: Map<string, Error> = new Map(),
  ) {}

  read(articleUrl: string): Promise<string> {
    this.calls.push(articleUrl);
    const failure = this.failuresByUrl.get(articleUrl);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    return Promise.resolve(this.textByUrl.get(articleUrl) ?? this.defaultText);
  }
}

export class StubEmbeddingGenerator implements EmbeddingGenerator {
  /** Every `embedDocuments` call, keeping the texts of each batch together. */
  readonly documentBatches: string[][] = [];
  readonly queries: string[] = [];

  constructor(private readonly embedding: number[] = [0.1, 0.2, 0.3]) {}

  get documents(): string[] {
    return this.documentBatches.flat();
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    this.documentBatches.push(documents);
    return Promise.resolve(documents.map(() => [...this.embedding]));
  }

  embedQuery(query: string): Promise<number[]> {
    this.queries.push(query);
    return Promise.resolve([...this.embedding]);
  }
}

export class InMemoryKnowledgeChunkRepository implements KnowledgeChunkRepository {
  readonly upsertCalls: KnowledgeChunk[][] = [];
  readonly searchCalls: { embedding: number[]; limit: number }[] = [];
  readonly store = new Map<string, KnowledgeChunk>();
  matches: KnowledgeSearchMatch[] = [];
  failure?: Error;

  upsert(chunks: KnowledgeChunk[]): Promise<void> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    this.upsertCalls.push(chunks);
    for (const chunk of chunks) {
      this.store.set(chunk.id, chunk);
    }
    return Promise.resolve();
  }

  search(embedding: number[], limit: number): Promise<KnowledgeSearchMatch[]> {
    this.searchCalls.push({ embedding, limit });
    return Promise.resolve(this.matches);
  }

  get lastUpsert(): KnowledgeChunk[] {
    return this.upsertCalls.at(-1) ?? [];
  }
}

export class RecordingEventBus implements EventBus {
  readonly published: DomainEvent[] = [];

  publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
    return Promise.resolve();
  }

  ofType<T extends DomainEvent>(eventName: string): T[] {
    return this.published.filter((event) => event.eventName === eventName) as T[];
  }
}

export class RecordingIngestionProgressReporter implements IngestionProgressReporter {
  readonly reports: FeedProgressReport[] = [];

  feedStarted(progress: FeedIngestionProgress): void {
    this.reports.push({ status: 'in progress', progress });
  }

  feedCompleted(
    progress: FeedIngestionProgress,
    totals: { articles: number; chunks: number; skippedArticles?: number },
  ): void {
    this.reports.push({ status: 'completed', progress, totals });
  }

  feedFailed(progress: FeedIngestionProgress, reason: string): void {
    this.reports.push({ status: 'failed', progress, reason });
  }
}

export class StubStructuredGraphGenerator implements StructuredGraphGenerator {
  readonly calls: { query: string; context: KnowledgeSearchMatch[] }[] = [];
  result: GeneratedGraph = { summary: 'stub summary', graph: EMPTY_GRAPH };
  error?: Error;

  generate(query: string, context: KnowledgeSearchMatch[]): Promise<GeneratedGraph> {
    this.calls.push({ query, context });
    if (this.error !== undefined) {
      return Promise.reject(this.error);
    }
    return Promise.resolve(this.result);
  }
}
