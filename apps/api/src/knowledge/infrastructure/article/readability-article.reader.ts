import { Readability } from '@mozilla/readability';
import { Injectable } from '@nestjs/common';
import { JSDOM } from 'jsdom';

import type { ReadableArticleReader } from '../../domain/readable-article-reader';

/**
 * Fetches the raw HTML of an article URL. Isolated behind an interface so the
 * network call can be stubbed in tests.
 */
export interface HtmlFetcher {
  fetch(url: string): Promise<string>;
}

const defaultHtmlFetcher: HtmlFetcher = {
  async fetch(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch article (${response.status}): ${url}`);
    }
    return response.text();
  },
};

/**
 * Extracts clean, readable article text using Mozilla Readability over a JSDOM
 * document.
 */
@Injectable()
export class ReadabilityArticleReader implements ReadableArticleReader {
  constructor(private readonly htmlFetcher: HtmlFetcher = defaultHtmlFetcher) {}

  async read(articleUrl: string): Promise<string> {
    const html = await this.htmlFetcher.fetch(articleUrl);
    const dom = new JSDOM(html, { url: articleUrl });
    const article = new Readability(dom.window.document).parse();

    return article?.textContent?.trim() ?? '';
  }
}
