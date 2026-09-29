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
  /** Every feed that produced no indexed content, without stopping the run. */
  issues: FeedIngestionIssue[];
}

/** Why a feed contributed no chunks to the run. */
export type FeedIssueType = 'inaccessible' | 'empty' | 'duplicate';

/**
 * A feed that produced no indexed content. `inaccessible` means fetching or
 * reading it threw (network error, broken RSS, unreachable article page).
 * `empty` means it was read without error but yielded zero chunks: either the
 * RSS feed has no entries, or none of its articles had extractable readable
 * text. `duplicate` means the OPML declares the same feed URL more than once;
 * only its first subscription is ingested.
 */
export interface FeedIngestionIssue {
  blogName: string;
  feedUrl: string;
  type: FeedIssueType;
  reason: string;
}

/**
 * Command that ingests the blogs declared in an OPML file into the vector store.
 *
 * For each subscription it fetches the RSS articles, extracts the readable text,
 * splits it into chunks, embeds them and collects deterministic
 * {@link KnowledgeChunk}s. All chunks are upserted idempotently. A failed feed is
 * isolated (its error is emitted as {@link KnowledgeIngestionFailed}) so the run
 * continues, and the run always ends by emitting {@link KnowledgeIngestionCompleted}.
 * Every feed that contributes no content, because it is unreachable or because it
 * yields no readable text, is collected into {@link IngestionResult.issues} so the
 * run ends with a full summary instead of scattered log lines. The progress of
 * every feed is reported through {@link IngestionProgressReporter}.
 *
 * Chunk ids derive from the article URL, so an article must be ingested at most
 * once per run: a feed URL repeated in the OPML is skipped (and reported as a
 * `duplicate` issue), and an article already ingested through another feed, or
 * listed twice in the same feed, is skipped silently.
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
    const { unique: subscriptions, duplicates } = this.splitDuplicateSubscriptions(
      await this.feedSubscriptions.read(opmlPath),
    );

    const chunks: KnowledgeChunk[] = [];
    const issues: FeedIngestionIssue[] = [...duplicates];
    const ingestedArticleUrls = new Set<string>();
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
        const feedChunks = await this.ingestSubscription(subscription, ingestedArticleUrls);
        chunks.push(...feedChunks.chunks);
        processedArticles += feedChunks.articleCount;
        processedFeeds += 1;
        this.progress.feedCompleted(feedProgress, {
          articles: feedChunks.articleCount,
          chunks: feedChunks.chunks.length,
        });

        // A feed whose articles were all ingested through an earlier feed is not empty.
        if (feedChunks.chunks.length === 0 && feedChunks.alreadyIngestedArticles === 0) {
          issues.push({
            blogName: subscription.blogName,
            feedUrl: subscription.feedUrl,
            type: 'empty',
            reason: this.emptyFeedReason(feedChunks.articleCount),
          });
        }
      } catch (error) {
        const reason = this.toReason(error);
        this.progress.feedFailed(feedProgress, reason);
        issues.push({
          blogName: subscription.blogName,
          feedUrl: subscription.feedUrl,
          type: 'inaccessible',
          reason,
        });
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
      issues,
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

  /**
   * Ingests the articles of a feed that were not already ingested earlier in the
   * run. URLs are only added to `ingestedArticleUrls` once the whole feed
   * succeeds, so the articles of a feed that fails halfway can still be
   * ingested through another feed.
   */
  private async ingestSubscription(
    subscription: FeedSubscription,
    ingestedArticleUrls: Set<string>,
  ): Promise<{ articleCount: number; alreadyIngestedArticles: number; chunks: KnowledgeChunk[] }> {
    const articles = await this.articleFeed.fetchArticles(subscription);
    const feedArticleUrls = new Set<string>();
    const chunks: KnowledgeChunk[] = [];
    let alreadyIngestedArticles = 0;

    for (const article of articles) {
      if (feedArticleUrls.has(article.url)) {
        continue; // Listed twice in the same feed.
      }
      if (ingestedArticleUrls.has(article.url)) {
        alreadyIngestedArticles += 1; // Cross-posted: ingested through an earlier feed.
        continue;
      }
      feedArticleUrls.add(article.url);

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

    for (const url of feedArticleUrls) {
      ingestedArticleUrls.add(url);
    }

    return { articleCount: feedArticleUrls.size, alreadyIngestedArticles, chunks };
  }

  /**
   * Keeps the first subscription of every feed URL. Later subscriptions with the
   * same URL would ingest the same articles again, so they become `duplicate`
   * issues pointing to the subscription that is actually ingested.
   */
  private splitDuplicateSubscriptions(subscriptions: FeedSubscription[]): {
    unique: FeedSubscription[];
    duplicates: FeedIngestionIssue[];
  } {
    const firstByFeedUrl = new Map<string, FeedSubscription>();
    const duplicates: FeedIngestionIssue[] = [];

    for (const subscription of subscriptions) {
      const first = firstByFeedUrl.get(subscription.feedUrl);
      if (first === undefined) {
        firstByFeedUrl.set(subscription.feedUrl, subscription);
        continue;
      }
      duplicates.push({
        blogName: subscription.blogName,
        feedUrl: subscription.feedUrl,
        type: 'duplicate',
        reason: `Same feed URL as "${first.blogName}", which is ingested instead`,
      });
    }

    return { unique: [...firstByFeedUrl.values()], duplicates };
  }

  private toReason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Distinguishes an RSS feed with no entries from one whose articles could
   * not be read (paywalled, blocked, or otherwise stripped of body text).
   */
  private emptyFeedReason(articleCount: number): string {
    return articleCount === 0
      ? 'No articles found in the RSS feed'
      : `No readable content extracted from ${articleCount} article(s)`;
  }
}
