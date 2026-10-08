export interface BookIngestionProgress {
  position: number;
  total: number;
  filePath: string;
}

export interface BookIngestionProgressReporter {
  bookStarted(progress: BookIngestionProgress): void;
  bookCompleted(
    progress: BookIngestionProgress,
    totals: { sections: number; chunks: number },
  ): void;
  bookFailed(progress: BookIngestionProgress, reason: string): void;
}
