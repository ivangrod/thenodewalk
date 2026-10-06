import { selectNewFeedArticles } from './select-new-feed-articles';
import { FeedArticleMother } from './testing/knowledge.mother';

describe('selectNewFeedArticles', () => {
  it('compares timestamps across timezones, sorts descending, and excludes the boundary', () => {
    const old = FeedArticleMother.create({ publishedAt: '2026-01-01T01:00:00+01:00' });
    const recent = FeedArticleMother.create({ publishedAt: 'Fri, 02 Jan 2026 00:00:00 GMT' });
    const newest = FeedArticleMother.create({ publishedAt: '2026-01-03T00:00:00Z' });
    const input = [old, newest, recent, newest];
    const result = selectNewFeedArticles(input, Date.parse('2026-01-01T00:00:00Z'));
    expect(result.articles.map((entry) => entry.article.url)).toEqual([newest.url, recent.url]);
    expect(result.skippedArticles).toBe(1);
    expect(input).toEqual([old, newest, recent, newest]);
  });

  it('keeps unknown dates even when every dated post is older than the watermark', () => {
    const dated = FeedArticleMother.create({ publishedAt: '2026-01-01T00:00:00Z' });
    const missing = FeedArticleMother.create({ publishedAt: null });
    const invalid = FeedArticleMother.create({ publishedAt: 'invalid' });
    const result = selectNewFeedArticles(
      [dated, missing, invalid],
      Date.parse('2026-02-01T00:00:00Z'),
    );
    expect(result.skippedArticles).toBe(1);
    expect(result.articles).toEqual([
      { article: missing, timestamp: null },
      { article: { ...invalid, publishedAt: null }, timestamp: null },
    ]);
  });
});
