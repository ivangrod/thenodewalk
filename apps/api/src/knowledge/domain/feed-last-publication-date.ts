export interface FeedLastPublicationDate {
  blogName: string;
  lastPublishedAt: string;
}

/** A per-run snapshot; no per-feed database reads are needed. */
export class FeedLastPublicationDates {
  private readonly dates: Map<string, number>;

  constructor(records: readonly FeedLastPublicationDate[]) {
    this.dates = new Map(
      records.map((record) => [record.blogName, Date.parse(record.lastPublishedAt)]),
    );
  }

  forBlog(blogName: string): number | undefined {
    return this.dates.get(blogName);
  }
}
