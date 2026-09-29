/**
 * Position of a feed within the OPML file being ingested.
 */
export interface FeedIngestionProgress {
  position: number;
  total: number;
  blogName: string;
  feedUrl: string;
}

/**
 * Port for reporting the progress of an ingestion run feed by feed. Progress is
 * not a state change, so it is reported through this port instead of domain events.
 */
export interface IngestionProgressReporter {
  feedStarted(progress: FeedIngestionProgress): void;
  feedCompleted(
    progress: FeedIngestionProgress,
    totals: { articles: number; chunks: number },
  ): void;
  feedFailed(progress: FeedIngestionProgress, reason: string): void;
}
