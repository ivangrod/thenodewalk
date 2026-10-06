import { Inject, Injectable } from '@nestjs/common';

import { EVENT_BUS } from '../../shared/application/event-bus.token';
import type { EventBus } from '../../shared/domain/event-bus';
import type { ArticleFeedReader } from '../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../domain/embedding-generator';
import { KnowledgeIngestionCompleted } from '../domain/events/knowledge-ingestion-completed';
import { KnowledgeIngestionFailed } from '../domain/events/knowledge-ingestion-failed';
import { KnowledgeFeedIngested } from '../domain/events/knowledge-feed-ingested';
import { FeedLastPublicationDates } from '../domain/feed-last-publication-date';
import type { FeedLastPublicationDateRepository } from '../domain/feed-last-publication-date-repository';
import { selectNewFeedArticles } from '../domain/select-new-feed-articles';
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
  FEED_LAST_PUBLICATION_DATE_REPOSITORY,
  INGESTION_PROGRESS_REPORTER,
  KNOWLEDGE_CHUNK_REPOSITORY,
  READABLE_ARTICLE_READER,
} from './knowledge.tokens';

export interface IngestionResult {
  processedFeeds: number;
  processedArticles: number;
  indexedChunks: number;
  skippedArticles: number;
  /** Every feed that produced no indexed content, without stopping the run. */
  issues: FeedIngestionIssue[];
}

/** Why a feed contributed no chunks to the run. */
export type FeedIssueType = 'inaccessible' | 'empty' | 'duplicate' | 'ambiguous-origin';

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
 * {@link KnowledgeChunk}s. Chunks are upserted idempotently per feed before publishing
 * {@link KnowledgeFeedIngested}. The PostgreSQL cursor snapshot is loaded once and
 * filtering happens before extraction or embedding. A failed feed is
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
    @Inject(FEED_LAST_PUBLICATION_DATE_REPOSITORY)
    private readonly publicationDates: FeedLastPublicationDateRepository,
  ) {}

  async execute(opmlPath: string, options: { full?: boolean } = {}): Promise<IngestionResult> {
    const { unique: subscriptions, duplicates } = this.splitDuplicateSubscriptions(
      await this.feedSubscriptions.read(opmlPath),
    );

    const dates = new FeedLastPublicationDates(
      options.full ? [] : await this.publicationDates.findAll(),
    );
    const names = new Set<string>();
    const ambiguousNames = new Set<string>();
    for (const subscription of subscriptions) {
      if (names.has(subscription.blogName)) ambiguousNames.add(subscription.blogName);
      names.add(subscription.blogName);
    }
    const issues: FeedIngestionIssue[] = [...duplicates];
    const ingestedArticleUrls = new Map<string, number | null>();
    let processedFeeds = 0;
    let processedArticles = 0;
    let indexedChunks = 0;
    let skippedArticles = 0;

    for (const [index, subscription] of subscriptions.entries()) {
      const feedProgress: FeedIngestionProgress = {
        position: index + 1,
        total: subscriptions.length,
        blogName: subscription.blogName,
        feedUrl: subscription.feedUrl,
      };
      this.progress.feedStarted(feedProgress);
      const ambiguous = ambiguousNames.has(subscription.blogName);
      if (ambiguous) {
        issues.push({
          blogName: subscription.blogName,
          feedUrl: subscription.feedUrl,
          type: 'ambiguous-origin',
          reason:
            'Distinct feeds share this blog name; full ingestion without saving a publication date',
        });
      }

      try {
        const feedChunks = await this.ingestSubscription(
          subscription,
          ingestedArticleUrls,
          ambiguous ? undefined : dates.forBlog(subscription.blogName),
        );
        if (feedChunks.chunks.length > 0) await this.repository.upsert(feedChunks.chunks);
        // Only successfully persisted articles may deduplicate later feeds.
        for (const [url, timestamp] of feedChunks.storedArticles)
          ingestedArticleUrls.set(url, timestamp);
        if (!ambiguous && feedChunks.lastPublishedAt !== null) {
          await this.eventBus.publish([
            new KnowledgeFeedIngested(
              subscription.blogName,
              subscription.feedUrl,
              new Date(feedChunks.lastPublishedAt).toISOString(),
              new Date().toISOString(),
            ),
          ]);
        }
        processedArticles += feedChunks.articleCount;
        indexedChunks += feedChunks.chunks.length;
        skippedArticles += feedChunks.alreadyIngestedArticles;
        processedFeeds += 1;
        this.progress.feedCompleted(feedProgress, {
          articles: feedChunks.articleCount,
          chunks: feedChunks.chunks.length,
          skippedArticles: feedChunks.alreadyIngestedArticles,
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

    const result: IngestionResult = {
      processedFeeds,
      processedArticles,
      indexedChunks,
      skippedArticles,
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
   * run. The caller marks URLs only after ChromaDB persistence succeeds, so a
   * feed that fails halfway can still be
   * ingested through another feed.
   */
  private async ingestSubscription(
    subscription: FeedSubscription,
    ingestedArticleUrls: Map<string, number | null>,
    lastPublishedAt?: number,
  ): Promise<{
    articleCount: number;
    alreadyIngestedArticles: number;
    chunks: KnowledgeChunk[];
    storedArticles: Map<string, number | null>;
    lastPublishedAt: number | null;
  }> {
    const selected = selectNewFeedArticles(
      await this.articleFeed.fetchArticles(subscription),
      lastPublishedAt,
    );
    const feedArticleUrls = new Set<string>();
    const chunks: KnowledgeChunk[] = [];
    const storedArticles = new Map<string, number | null>();
    let alreadyIngestedArticles = selected.skippedArticles;
    let latest: number | null = null;

    for (const { article, timestamp } of selected.articles) {
      if (feedArticleUrls.has(article.url)) {
        continue; // Listed twice in the same feed.
      }
      if (ingestedArticleUrls.has(article.url)) {
        alreadyIngestedArticles += 1; // Cross-posted: ingested through an earlier feed.
        // Use the date actually stored, not a conflicting date from this feed.
        const storedDate = ingestedArticleUrls.get(article.url);
        if (storedDate !== undefined && storedDate !== null)
          latest = Math.max(latest ?? storedDate, storedDate);
        continue;
      }
      feedArticleUrls.add(article.url);

      const text = await this.readableArticle.read(article.url);

      const documents = chunkText(text);
      for (const [chunkIndex, document] of documents.entries()) {
        const embedding = await this.embeddings.generate(document);
        chunks.push(
          createKnowledgeChunk({
            document,
            embedding,
            metadata: {
              blogName: subscription.blogName,
              articleTitle: article.title,
              articleUrl: article.url,
              publishedAt: timestamp === null ? '' : new Date(timestamp).toISOString(),
              chunkIndex,
            },
          }),
        );
      }
      if (documents.length > 0) {
        storedArticles.set(article.url, timestamp);
        if (timestamp !== null) latest = Math.max(latest ?? timestamp, timestamp);
      }
    }

    return {
      articleCount: feedArticleUrls.size,
      alreadyIngestedArticles,
      chunks,
      storedArticles,
      lastPublishedAt: latest,
    };
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
