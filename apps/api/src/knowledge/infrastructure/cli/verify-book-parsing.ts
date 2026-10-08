import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { extractText, getDocumentProxy } from 'unpdf';

/** Dependency spike: run both with ts-node and as the compiled CommonJS CLI. */
async function run(): Promise<void> {
  const fixtures = resolve('test/fixtures/books');
  const zip = await JSZip.loadAsync(await readFile(resolve(fixtures, 'sample.epub')));
  const chapter = await zip.file('EPUB/chapter.xhtml')?.async('string');
  assert(chapter);
  const dom = new JSDOM(chapter, { contentType: 'application/xhtml+xml' });
  try {
    assert.equal(dom.window.document.querySelector('h1')?.textContent, 'Small feedback loops');
  } finally {
    dom.window.close();
  }

  const pdf = await getDocumentProxy(
    new Uint8Array(await readFile(resolve(fixtures, 'sample.pdf'))),
  );
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    assert.equal(totalPages, 2);
    assert.deepEqual(text, [
      'Small feedback loops make changes easier to review.',
      'Tests preserve useful behaviour across changes.',
    ]);
    const { info } = await pdf.getMetadata();
    assert('Title' in info);
    assert.equal(info.Title, 'Sample Engineering Book');
    const outline = await pdf.getOutline();
    const destination = outline?.[1]?.dest;
    assert(Array.isArray(destination));
    assert.equal(await pdf.getPageIndex(destination[0]), 1);
  } finally {
    await pdf.loadingTask.destroy();
  }
  console.log('Book parsing verified: EPUB XHTML, PDF pages, metadata and outline destinations.');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
