import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { extractText, getDocumentProxy } from 'unpdf';

const FIXTURES = resolve(__dirname, '../../../../test/fixtures/books');

describe('book parsing libraries', () => {
  it('opens the EPUB fixture archive and reads its XHTML with jsdom', async () => {
    const zip = await JSZip.loadAsync(await readFile(resolve(FIXTURES, 'sample.epub')));
    expect(await zip.file('mimetype')?.async('string')).toBe('application/epub+zip');
    const chapter = await zip.file('EPUB/chapter.xhtml')?.async('string');
    expect(chapter).toBeDefined();
    const dom = new JSDOM(chapter, { contentType: 'application/xhtml+xml' });
    try {
      expect(dom.window.document.querySelector('h1')?.textContent).toBe('Small feedback loops');
    } finally {
      dom.window.close();
    }
  });

  it('reads PDF text per page, metadata and outline destinations', async () => {
    const pdf = await getDocumentProxy(
      new Uint8Array(await readFile(resolve(FIXTURES, 'sample.pdf'))),
    );
    try {
      const { totalPages, text } = await extractText(pdf, { mergePages: false });
      expect(totalPages).toBe(2);
      expect(text).toEqual([
        'Small feedback loops make changes easier to review.',
        'Tests preserve useful behaviour across changes.',
      ]);
      const { info } = await pdf.getMetadata();
      expect(info).toMatchObject({ Title: 'Sample Engineering Book', Author: 'The Node Walk' });
      const outline = await pdf.getOutline();
      expect(outline?.map((entry) => entry.title)).toEqual(['Small feedback loops', 'Tests']);
      const destination = outline?.[1]?.dest;
      expect(Array.isArray(destination)).toBe(true);
      if (!Array.isArray(destination)) throw new Error('Missing outline destination');
      expect(await pdf.getPageIndex(destination[0])).toBe(1);
    } finally {
      await pdf.loadingTask.destroy();
    }
  });
});
