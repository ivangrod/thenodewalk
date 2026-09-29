import type { FeedIngestionProgress } from '../../domain/ingestion-progress-reporter';
import {
  LoggerIngestionProgressReporter,
  type ProgressLogger,
} from './logger-ingestion-progress-reporter';

class RecordingLogger implements ProgressLogger {
  readonly logs: string[] = [];
  readonly warnings: string[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }
}

const PROGRESS: FeedIngestionProgress = {
  position: 1,
  total: 2,
  blogName: 'Netflix Tech Blog',
  feedUrl: 'https://netflixtechblog.com/feed',
};

describe('LoggerIngestionProgressReporter', () => {
  it('logs the feed position, name and url as in progress', () => {
    const logger = new RecordingLogger();

    new LoggerIngestionProgressReporter(logger).feedStarted(PROGRESS);

    expect(logger.logs).toEqual([
      '[1/2] Netflix Tech Blog (https://netflixtechblog.com/feed): in progress',
    ]);
  });

  it('logs the completed feed with its article and chunk totals', () => {
    const logger = new RecordingLogger();

    new LoggerIngestionProgressReporter(logger).feedCompleted(PROGRESS, {
      articles: 15,
      chunks: 140,
    });

    expect(logger.logs).toEqual(['[1/2] Netflix Tech Blog: completed (15 articles, 140 chunks)']);
  });

  it('logs a failed feed as a warning with its reason', () => {
    const logger = new RecordingLogger();

    new LoggerIngestionProgressReporter(logger).feedFailed(
      { ...PROGRESS, position: 2, blogName: 'AWS Architecture Blog' },
      'feed unreachable',
    );

    expect(logger.warnings).toEqual(['[2/2] AWS Architecture Blog: failed (feed unreachable)']);
    expect(logger.logs).toEqual([]);
  });
});
