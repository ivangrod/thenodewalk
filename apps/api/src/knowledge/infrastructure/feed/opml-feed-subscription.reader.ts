import { readFile } from 'node:fs/promises';

import { Injectable } from '@nestjs/common';
import { JSDOM } from 'jsdom';

import type {
  FeedSubscription,
  FeedSubscriptionReader,
} from '../../domain/feed-subscription-reader';

/**
 * Reads an OPML file and turns every `<outline xmlUrl="...">` entry into a
 * {@link FeedSubscription}.
 */
@Injectable()
export class OpmlFeedSubscriptionReader implements FeedSubscriptionReader {
  async read(opmlPath: string): Promise<FeedSubscription[]> {
    const xml = await readFile(opmlPath, 'utf-8');
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const outlines = Array.from(dom.window.document.querySelectorAll('outline[xmlUrl]'));

    return outlines.reduce<FeedSubscription[]>((subscriptions, outline) => {
      const feedUrl = outline.getAttribute('xmlUrl');
      if (feedUrl === null || feedUrl.trim() === '') {
        return subscriptions;
      }

      const blogName = outline.getAttribute('title') ?? outline.getAttribute('text') ?? feedUrl;
      subscriptions.push({ blogName, feedUrl });
      return subscriptions;
    }, []);
  }
}
