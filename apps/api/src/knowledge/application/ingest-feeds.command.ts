import { Inject, Injectable } from '@nestjs/common';

import { EVENT_BUS } from '../../shared/application/event-bus.token';
import type { EventBus } from '../../shared/domain/event-bus';
import type { ArticleFeedReader } from '../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../domain/embedding-generator';
import { KnowledgeIngestionCompleted } from '../domain/events/knowledge-ingestion-completed';
import { KnowledgeIngestionFailed } from '../domain/events/knowledge-ingestion-failed';
import type { FeedSubscription, FeedSubscriptionReader } from '../domain/feed-subscription-reader';
import type {
  FeedIngestionProgress,
  IngestionProgressReporter,
} from '../domain/ingestion-progress-reporter';
import { createKnowledgeChunk, type KnowledgeChunk } from '../domain/knowledge-chunk';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import type { ReadableArticleReader } from '../domain/readable-article-reader';
import { chunkText } from '../domain/text-chunker';
import {
  ARTICLE_FEED_READER,
  EMBEDDING_GENERATOR,
  FEED_SUBSCRIPTION_READER,
  INGESTION_PROGRESS_REPORTER,
  KNOWLEDGE_CHUNK_REPOSITORY,
  READABLE_ARTICLE_READER,
} from './knowledge.tokens';

export interface IngestionResult {
  processedFeeds: number;
  processedArticles: number;
  indexedChunks: number;
}

/**
 * Command that ingests the blogs declared in an OPML file into the vector store.
 *
 * For each subscription it fetches the RSS articles, extracts the readable text,
 * splits it into chunks, embeds them and collects deterministic
 * {@link KnowledgeChunk}s. All chunks are upserted idempotently. A failed feed is
 * isolated (its error is emitted as {@link KnowledgeIngestionFailed}) so the run
 * continues, and the run always ends by emitting {@link KnowledgeIngestionCompleted}.
 * The progress of every feed is reported through {@link IngestionProgressReporter}.
 */
@Injectable()
export class IngestFeedsCommand {
  constructor(
    @Inject(FEED_SUBSCRIPTION_READER)
    private readonly feedSubscriptions: FeedSubscriptionReader,
    @Inject(ARTICLE_FEED_READER)
    private readonly articleFeed: ArticleFeedReader,
    @Inject(READABLE_ARTICLE_READER)
    private readonly readableArticle: ReadableArticleReader,
    @Inject(EMBEDDING_GENERATOR)
    private readonly embeddings: EmbeddingGenerator,
    @Inject(KNOWLEDGE_CHUNK_REPOSITORY)
    private readonly repository: KnowledgeChunkRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
    @Inject(INGESTION_PROGRESS_REPORTER)
    private readonly progress: IngestionProgressReporter,
  ) {}

  async execute(opmlPath: string): Promise<IngestionResult> {
    const subscriptions = await this.feedSubscriptions.read(opmlPath);

    const chunks: KnowledgeChunk[] = [];
    let processedFeeds = 0;
    let processedArticles = 0;

    for (const [index, subscription] of subscriptions.entries()) {
      const feedProgress: FeedIngestionProgress = {
        position: index + 1,
        total: subscriptions.length,
        blogName: subscription.blogName,
        feedUrl: subscription.feedUrl,
      };
      this.progress.feedStarted(feedProgress);

      try {
        const feedChunks = await this.ingestSubscription(subscription);
        chunks.push(...feedChunks.chunks);
        processedArticles += feedChunks.articleCount;
        processedFeeds += 1;
        this.progress.feedCompleted(feedProgress, {
          articles: feedChunks.articleCount,
          chunks: feedChunks.chunks.length,
        });
      } catch (error) {
        const reason = this.toReason(error);
        this.progress.feedFailed(feedProgress, reason);
        await this.eventBus.publish([
          new KnowledgeIngestionFailed(subscription.feedUrl, reason, new Date().toISOString()),
        ]);
      }
    }

    if (chunks.length > 0) {
      await this.repository.upsert(chunks);
    }

    const result: IngestionResult = {
      processedFeeds,
      processedArticles,
      indexedChunks: chunks.length,
    };

    await this.eventBus.publish([
      new KnowledgeIngestionCompleted(
        result.processedFeeds,
        result.processedArticles,
        result.indexedChunks,
        new Date().toISOString(),
      ),
    ]);

    return result;
  }

  private async ingestSubscription(
    subscription: FeedSubscription,
  ): Promise<{ articleCount: number; chunks: KnowledgeChunk[] }> {
    const articles = await this.articleFeed.fetchArticles(subscription);
    const chunks: KnowledgeChunk[] = [];

    for (const article of articles) {
      const text = await this.readableArticle.read(article.url);

      for (const [chunkIndex, document] of chunkText(text).entries()) {
        const embedding = await this.embeddings.generate(document);
        chunks.push(
          createKnowledgeChunk({
            document,
            embedding,
            metadata: {
              blogName: subscription.blogName,
              articleTitle: article.title,
              articleUrl: article.url,
              publishedAt: article.publishedAt,
              chunkIndex,
            },
          }),
        );
      }
    }

    return { articleCount: articles.length, chunks };
  }

  private toReason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
