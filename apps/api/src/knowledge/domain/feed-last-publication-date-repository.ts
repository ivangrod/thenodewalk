import type { FeedLastPublicationDate } from './feed-last-publication-date';

export interface FeedLastPublicationDateRepository {
  findAll(): Promise<FeedLastPublicationDate[]>;
  /** Atomically preserves the greatest stored date, even across concurrent runs. */
  save(record: FeedLastPublicationDate & { feedUrl: string }): Promise<void>;
}
