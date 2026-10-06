import Parser from 'rss-parser';

import { FeedSubscriptionMother } from '../../domain/testing/knowledge.mother';
import { RssArticleFeedReader } from './rss-article-feed.reader';

describe('RssArticleFeedReader', () => {
  it('normalizes real dates and leaves missing or invalid publication dates unknown', async () => {
    const parser = new Parser();
    jest.spyOn(parser, 'parseURL').mockResolvedValue({
      items: [
        { link: 'https://blog.test/dated', pubDate: 'Fri, 02 Jan 2026 01:00:00 +0100' },
        { link: 'https://blog.test/missing' },
        { link: 'https://blog.test/invalid', pubDate: 'not a date' },
        { link: '' },
      ],
    });
    const articles = await new RssArticleFeedReader(parser).fetchArticles(
      FeedSubscriptionMother.create(),
    );
    expect(articles.map((article) => article.publishedAt)).toEqual([
      '2026-01-02T00:00:00.000Z',
      null,
      null,
    ]);
    expect(articles).toHaveLength(3);
  });
});
