import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';

import type { ArticleFeedReader, FeedArticle } from '../../domain/article-feed-reader';
import type { FeedSubscription } from '../../domain/feed-subscription-reader';

/**
 * Lists the recent articles of a blog by parsing its RSS feed.
 */
@Injectable()
export class RssArticleFeedReader implements ArticleFeedReader {
  constructor(private readonly parser: Parser = new Parser()) {}

  async fetchArticles(subscription: FeedSubscription): Promise<FeedArticle[]> {
    const feed = await this.parser.parseURL(subscription.feedUrl);

    return (feed.items ?? []).reduce<FeedArticle[]>((articles, item) => {
      if (item.link === undefined || item.link.trim() === '') {
        return articles;
      }

      const date = Date.parse(item.isoDate ?? item.pubDate ?? '');
      articles.push({
        title: item.title ?? 'Untitled',
        url: item.link,
        publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
      });
      return articles;
    }, []);
  }
}
