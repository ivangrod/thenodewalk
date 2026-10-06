import { Logger, type LoggerService } from '@nestjs/common';

import type {
  FeedIngestionProgress,
  IngestionProgressReporter,
} from '../../domain/ingestion-progress-reporter';

/**
 * Subset of the Nest logger used to print ingestion progress.
 */
export type ProgressLogger = Pick<LoggerService, 'log' | 'warn'>;

/**
 * {@link IngestionProgressReporter} adapter that prints one line per feed state
 * through the Nest logger, prefixed with the feed position in the OPML file.
 */
export class LoggerIngestionProgressReporter implements IngestionProgressReporter {
  constructor(private readonly logger: ProgressLogger) {}

  feedStarted(progress: FeedIngestionProgress): void {
    this.logger.log(
      `${this.prefix(progress)} ${progress.blogName} (${progress.feedUrl}): in progress`,
    );
  }

  feedCompleted(
    progress: FeedIngestionProgress,
    totals: { articles: number; chunks: number; skippedArticles?: number },
  ): void {
    this.logger.log(
      `${this.prefix(progress)} ${progress.blogName}: completed (${totals.articles} articles, ${totals.chunks} chunks)${totals.skippedArticles === undefined ? '' : `, ${totals.skippedArticles} articles already ingested`}`,
    );
  }

  feedFailed(progress: FeedIngestionProgress, reason: string): void {
    this.logger.warn(`${this.prefix(progress)} ${progress.blogName}: failed (${reason})`);
  }

  private prefix(progress: FeedIngestionProgress): string {
    return `[${progress.position}/${progress.total}]`;
  }
}

/**
 * Builds the production reporter bound to a Nest {@link Logger} context.
 */
export function createLoggerIngestionProgressReporter(): LoggerIngestionProgressReporter {
  return new LoggerIngestionProgressReporter(new Logger('IngestionProgress'));
}
