import type { FeedSubscription } from './feed-subscription-reader';

/**
 * An article entry discovered in a blog RSS feed.
 */
export interface FeedArticle {
  title: string;
  url: string;
  publishedAt: string;
}

/**
 * Port for listing the recent articles published by a blog subscription.
 */
export interface ArticleFeedReader {
  fetchArticles(subscription: FeedSubscription): Promise<FeedArticle[]>;
}
