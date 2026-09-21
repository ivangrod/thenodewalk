import type { EventBus } from '../../../shared/domain/event-bus';
import type { DomainEvent } from '../../../shared/domain/domain-event';
import type { ArticleFeedReader, FeedArticle } from '../../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../../domain/embedding-generator';
import type {
  FeedSubscription,
  FeedSubscriptionReader,
} from '../../domain/feed-subscription-reader';
import type { KnowledgeChunk } from '../../domain/knowledge-chunk';
import type {
  KnowledgeChunkRepository,
  KnowledgeSearchMatch,
} from '../../domain/knowledge-chunk-repository';
import type { GeneratedGraph } from '../../domain/knowledge-graph';
import { EMPTY_GRAPH } from '../../domain/knowledge-graph';
import type { ReadableArticleReader } from '../../domain/readable-article-reader';
import type { StructuredGraphGenerator } from '../../domain/structured-graph-generator';

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
  readonly searchCalls: { embedding: number[]; limit: number }[] = [];
  readonly store = new Map<string, KnowledgeChunk>();
  matches: KnowledgeSearchMatch[] = [];

  upsert(chunks: KnowledgeChunk[]): Promise<void> {
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
