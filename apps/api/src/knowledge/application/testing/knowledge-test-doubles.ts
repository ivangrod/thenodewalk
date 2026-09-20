import type { EventBus } from '../../../shared/domain/event-bus';
import type { DomainEvent } from '../../../shared/domain/domain-event';
import type { ArticleFeedReader, FeedArticle } from '../../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../../domain/embedding-generator';
import type {
  FeedSubscription,
  FeedSubscriptionReader,
} from '../../domain/feed-subscription-reader';
import type { KnowledgeChunk } from '../../domain/knowledge-chunk';
import type { KnowledgeChunkRepository } from '../../domain/knowledge-chunk-repository';
import type { ReadableArticleReader } from '../../domain/readable-article-reader';

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
  constructor(
    private readonly textByUrl: Map<string, string> = new Map(),
    private readonly defaultText = '',
  ) {}

  read(articleUrl: string): Promise<string> {
    return Promise.resolve(this.textByUrl.get(articleUrl) ?? this.defaultText);
  }
}

export class StubEmbeddingGenerator implements EmbeddingGenerator {
  readonly prompts: string[] = [];

  constructor(private readonly embedding: number[] = [0.1, 0.2, 0.3]) {}

  generate(text: string): Promise<number[]> {
    this.prompts.push(text);
    return Promise.resolve([...this.embedding]);
  }
}

export class InMemoryKnowledgeChunkRepository implements KnowledgeChunkRepository {
  readonly upsertCalls: KnowledgeChunk[][] = [];
  readonly store = new Map<string, KnowledgeChunk>();

  upsert(chunks: KnowledgeChunk[]): Promise<void> {
    this.upsertCalls.push(chunks);
    for (const chunk of chunks) {
      this.store.set(chunk.id, chunk);
    }
    return Promise.resolve();
  }

  search(): Promise<KnowledgeChunk[]> {
    return Promise.resolve([...this.store.values()]);
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
