/**
 * Port for fetching an article URL and extracting its clean, readable text
 * (stripped of navigation, ads and boilerplate).
 */
export interface ReadableArticleReader {
  read(articleUrl: string): Promise<string>;
}
