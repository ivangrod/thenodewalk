import type { FeedArticle } from './article-feed-reader';

export interface DatedFeedArticle {
  article: FeedArticle;
  timestamp: number | null;
}

/** Parse once, sort newest first, then stop at the first previously indexed date. */
export function selectNewFeedArticles(
  articles: readonly FeedArticle[],
  lastPublishedAt?: number,
): { articles: DatedFeedArticle[]; skippedArticles: number } {
  const dated: DatedFeedArticle[] = [];
  const undated: DatedFeedArticle[] = [];
  const urls = new Set<string>();

  for (const article of articles) {
    if (urls.has(article.url)) continue;
    urls.add(article.url);
    const timestamp = article.publishedAt === null ? NaN : Date.parse(article.publishedAt);
    if (Number.isFinite(timestamp)) {
      dated.push({ article, timestamp });
    } else {
      undated.push({ article: { ...article, publishedAt: null }, timestamp: null });
    }
  }
  dated.sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0));
  let boundary = 0;
  while (boundary < dated.length) {
    if (lastPublishedAt !== undefined && (dated[boundary]?.timestamp ?? 0) <= lastPublishedAt)
      break;
    boundary += 1;
  }
  return {
    articles: [...dated.slice(0, boundary), ...undated],
    skippedArticles: dated.length - boundary,
  };
}
