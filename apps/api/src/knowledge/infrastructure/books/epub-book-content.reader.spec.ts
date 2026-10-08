import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import JSZip from 'jszip';

import { BookFileMother } from '../../domain/testing/book.mother';
import { EpubBookContentReader } from './epub-book-content.reader';
import { CompositeBookContentReader } from './composite-book-content.reader';
import { PdfBookContentReader } from './pdf-book-content.reader';

const FIXTURE = resolve(__dirname, '../../../../test/fixtures/books/sample.epub');

describe('EpubBookContentReader', () => {
  it('reads EPUB 2 NCX titles when EPUB 3 navigation is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tnw-ncx-'));
    try {
      const zip = await JSZip.loadAsync(await readFile(FIXTURE));
      const opf = await zip.file('EPUB/content.opf')!.async('string');
      zip.file(
        'EPUB/content.opf',
        opf.replace(
          '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
          '<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        ),
      );
      zip.file(
        'EPUB/toc.ncx',
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint><navLabel><text>NCX feedback chapter</text></navLabel><content src="chapter.xhtml"/></navPoint></navMap></ncx>',
      );
      const filePath = join(root, 'book.epub');
      await writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
      const content = await new EpubBookContentReader().read(BookFileMother.create({ filePath }));
      expect(content.sections[0]?.title).toBe('NCX feedback chapter');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('reads OPF metadata, spine text, navigation titles and content hash', async () => {
    const result = await new EpubBookContentReader().read(
      BookFileMother.create({ filePath: FIXTURE }),
    );
    expect(result).toMatchObject({
      title: 'Sample Engineering Book',
      authors: ['The Node Walk'],
      sections: [{ index: 0, title: 'Small feedback loops', pageStart: null, pageEnd: null }],
    });
    expect(result.sections[0]?.text).toContain('easier to review');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('preserves spine order and skips empty sections', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tnw-epub-'));
    try {
      const zip = await JSZip.loadAsync(await readFile(FIXTURE));
      const opf = await zip.file('EPUB/content.opf')!.async('string');
      zip.file(
        'EPUB/content.opf',
        opf
          .replace(
            '</manifest>',
            '<item id="second" href="second.xhtml" media-type="application/xhtml+xml"/><item id="empty" href="empty.xhtml" media-type="application/xhtml+xml"/></manifest>',
          )
          .replace('</spine>', '<itemref idref="empty"/><itemref idref="second"/></spine>'),
      );
      zip.file(
        'EPUB/empty.xhtml',
        '<html xmlns="http://www.w3.org/1999/xhtml"><body> </body></html>',
      );
      zip.file(
        'EPUB/second.xhtml',
        '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Second</h1><p>Second section content</p></body></html>',
      );
      const filePath = join(root, 'book.epub');
      await writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
      const result = await new EpubBookContentReader().read(BookFileMother.create({ filePath }));
      expect(result.sections.map(({ index, title }) => [index, title])).toEqual([
        [0, 'Small feedback loops'],
        [2, 'Second'],
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails clearly on corrupt archives and dispatches PDF to its reader', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tnw-corrupt-'));
    try {
      const filePath = join(root, 'broken.epub');
      await writeFile(filePath, 'invalid zip');
      await expect(
        new EpubBookContentReader().read(BookFileMother.create({ filePath })),
      ).rejects.toThrow();
      const pdf = await new CompositeBookContentReader(
        new EpubBookContentReader(),
        new PdfBookContentReader(),
      ).read(
        BookFileMother.create({
          format: 'pdf',
          filePath: resolve(__dirname, '../../../../test/fixtures/books/sample.pdf'),
        }),
      );
      expect(pdf.sections).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
