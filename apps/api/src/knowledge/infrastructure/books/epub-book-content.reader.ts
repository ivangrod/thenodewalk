import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, posix } from 'node:path';

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';

import type {
  BookContent,
  BookContentReader,
  BookFile,
  BookSection,
} from '../../domain/book-content-reader';

function parseXml(text: string): JSDOM {
  return new JSDOM(text, { contentType: 'application/xml' });
}

function elements(document: Document, name: string): Element[] {
  return Array.from(document.getElementsByTagNameNS('*', name));
}

async function entryText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`Missing EPUB entry: ${path}`);
  return entry.async('string');
}

function resolveEntry(base: string, href: string): string {
  const path = posix.normalize(
    posix.join(posix.dirname(base), decodeURIComponent(href.split('#')[0] ?? '')),
  );
  if (path.startsWith('../') || posix.isAbsolute(path))
    throw new Error(`Invalid EPUB entry path: ${href}`);
  return path;
}

export class EpubBookContentReader implements BookContentReader {
  async read(file: BookFile): Promise<BookContent> {
    const bytes = await readFile(file.filePath);
    const zip = await JSZip.loadAsync(bytes);
    const container = parseXml(await entryText(zip, 'META-INF/container.xml'));
    let opfPath: string;
    try {
      opfPath = elements(container.window.document, 'rootfile')[0]?.getAttribute('full-path') ?? '';
      if (!opfPath) throw new Error('EPUB container has no package rootfile');
    } finally {
      container.window.close();
    }
    const opf = parseXml(await entryText(zip, opfPath));
    try {
      const document = opf.window.document;
      const title =
        elements(document, 'title')[0]?.textContent?.trim() || basename(file.filePath, '.epub');
      const authors = elements(document, 'creator')
        .map((entry) => entry.textContent?.trim() ?? '')
        .filter(Boolean);
      const manifest = new Map(
        elements(document, 'item').map((item) => [item.getAttribute('id') ?? '', item]),
      );
      const titles = await this.navigationTitles(zip, opfPath, manifest);
      const sections: BookSection[] = [];
      for (const [index, itemref] of elements(document, 'itemref').entries()) {
        if (itemref.getAttribute('linear') === 'no') continue;
        const item = manifest.get(itemref.getAttribute('idref') ?? '');
        if (!item) throw new Error('EPUB spine references an unknown manifest item');
        if (item.getAttribute('properties')?.split(/\s+/).includes('nav')) continue;
        const path = resolveEntry(opfPath, item.getAttribute('href') ?? '');
        const dom = new JSDOM(await entryText(zip, path), { contentType: 'application/xhtml+xml' });
        try {
          dom.window.document
            .querySelectorAll('script, style, nav')
            .forEach((node) => node.remove());
          const body = dom.window.document.querySelector('body');
          if (!body) continue;
          body
            .querySelectorAll('p, div, h1, h2, h3, li, br, pre, blockquote')
            .forEach((node) => node.append('\n'));
          const text =
            body.textContent
              ?.replace(/[ \t]+/g, ' ')
              .replace(/\n\s*\n/g, '\n')
              .trim() ?? '';
          if (!text) continue;
          const sectionTitle =
            titles.get(path) ||
            body.querySelector('h1, h2')?.textContent?.trim() ||
            dom.window.document.querySelector('title')?.textContent?.trim() ||
            `Section ${index + 1}`;
          sections.push({ index, title: sectionTitle, text, pageStart: null, pageEnd: null });
        } finally {
          dom.window.close();
        }
      }
      return {
        contentHash: createHash('sha256').update(bytes).digest('hex'),
        title,
        authors,
        sections,
      };
    } finally {
      opf.window.close();
    }
  }

  private async navigationTitles(
    zip: JSZip,
    opfPath: string,
    manifest: Map<string, Element>,
  ): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const nav = [...manifest.values()].find((item) =>
      item.getAttribute('properties')?.split(/\s+/).includes('nav'),
    );
    const ncx = [...manifest.values()].find(
      (item) => item.getAttribute('media-type') === 'application/x-dtbncx+xml',
    );
    const item = nav ?? ncx;
    if (!item) return titles;
    const path = resolveEntry(opfPath, item.getAttribute('href') ?? '');
    const dom = parseXml(await entryText(zip, path));
    try {
      if (nav) {
        const toc = elements(dom.window.document, 'nav').find((entry) =>
          entry.getAttribute('epub:type')?.split(/\s+/).includes('toc'),
        );
        const anchors = toc
          ? Array.from(toc.getElementsByTagNameNS('*', 'a'))
          : elements(dom.window.document, 'a');
        for (const anchor of anchors) {
          const href = anchor.getAttribute('href');
          if (href && anchor.textContent?.trim()) {
            const target = resolveEntry(path, href);
            if (!titles.has(target)) titles.set(target, anchor.textContent.trim());
          }
        }
      } else {
        for (const point of elements(dom.window.document, 'navPoint')) {
          const href = point.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('src');
          const label = point.getElementsByTagNameNS('*', 'text')[0]?.textContent?.trim();
          if (href && label) titles.set(resolveEntry(path, href), label);
        }
      }
    } finally {
      dom.window.close();
    }
    return titles;
  }
}
