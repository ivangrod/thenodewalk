/**
 * A blog subscription declared in the OPML feed list.
 */
export interface FeedSubscription {
  blogName: string;
  feedUrl: string;
}

/**
 * Port for reading the OPML feed list into blog subscriptions.
 */
export interface FeedSubscriptionReader {
  read(opmlPath: string): Promise<FeedSubscription[]>;
}
