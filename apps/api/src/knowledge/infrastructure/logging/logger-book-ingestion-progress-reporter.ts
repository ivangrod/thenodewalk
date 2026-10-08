import { Logger } from '@nestjs/common';

import type {
  BookIngestionProgress,
  BookIngestionProgressReporter,
} from '../../domain/book-ingestion-progress-reporter';

export class LoggerBookIngestionProgressReporter implements BookIngestionProgressReporter {
  private readonly logger = new Logger('BookIngestion');

  bookStarted(progress: BookIngestionProgress): void {
    this.logger.log(`${this.label(progress)}: in progress`);
  }

  bookCompleted(
    progress: BookIngestionProgress,
    totals: { sections: number; chunks: number },
  ): void {
    this.logger.log(
      `${this.label(progress)}: completed (${totals.sections} sections, ${totals.chunks} chunks)`,
    );
  }

  bookFailed(progress: BookIngestionProgress, reason: string): void {
    this.logger.warn(`${this.label(progress)}: failed (${reason})`);
  }

  private label(progress: BookIngestionProgress): string {
    return `[${progress.position}/${progress.total}] ${progress.filePath}`;
  }
}
