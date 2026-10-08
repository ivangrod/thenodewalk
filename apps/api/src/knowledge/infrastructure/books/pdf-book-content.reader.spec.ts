import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { BookFileMother } from '../../domain/testing/book.mother';
import { PdfBookContentReader } from './pdf-book-content.reader';
import { pdfFixture } from './testing/pdf-fixture';

async function readFixture(
  bytes: Buffer,
): Promise<Awaited<ReturnType<PdfBookContentReader['read']>>> {
  const root = await mkdtemp(join(tmpdir(), 'tnw-pdf-'));
  try {
    const filePath = join(root, 'fallback-title.pdf');
    await writeFile(filePath, bytes);
    return await new PdfBookContentReader().read(
      BookFileMother.create({ filePath, format: 'pdf' }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe('PdfBookContentReader', () => {
  it('reads real PDF metadata and sections from bookmark destinations with physical page ranges', async () => {
    const content = await new PdfBookContentReader().read(
      BookFileMother.create({
        format: 'pdf',
        filePath: resolve(__dirname, '../../../../test/fixtures/books/sample.pdf'),
      }),
    );
    expect(content).toMatchObject({
      title: 'Sample Engineering Book',
      authors: ['The Node Walk'],
      sections: [
        { index: 0, title: 'Small feedback loops', pageStart: 1, pageEnd: 1 },
        { index: 1, title: 'Tests', pageStart: 2, pageEnd: 2 },
      ],
    });
    expect(content.sections[0]?.text).toContain('easier to review');
    expect(content.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('falls back to ten-page sections and filename metadata without an outline', async () => {
    const content = await readFixture(
      pdfFixture(Array.from({ length: 11 }, (_, index) => [`Body page ${index + 1}`])),
    );
    expect(content.title).toBe('fallback-title');
    expect(content.authors).toEqual([]);
    expect(
      content.sections.map(({ title, pageStart, pageEnd }) => ({ title, pageStart, pageEnd })),
    ).toEqual([
      { title: 'Pages 1-10', pageStart: 1, pageEnd: 10 },
      { title: 'Pages 11-11', pageStart: 11, pageEnd: 11 },
    ]);
    expect(content.sections[1]?.text).toBe('Body page 11');
  });

  it('resolves named destinations and excludes Copyright, Contents and Index sections', async () => {
    const content = await readFixture(
      pdfFixture(
        [
          ['Copyright material'],
          ['Contents ....... 5'],
          ['Useful first chapter'],
          ['Useful continuation'],
          ['Index terms'],
        ],
        {
          bookmarks: [
            { title: 'Copyright', page: 1 },
            { title: 'Contents', page: 2 },
            { title: 'Engineering', page: 3, named: true },
            { title: 'Index', page: 5 },
          ],
        },
      ),
    );
    expect(content.sections).toEqual([
      {
        index: 2,
        title: 'Engineering',
        pageStart: 3,
        pageEnd: 4,
        text: 'Useful first chapter\n\nUseful continuation',
      },
    ]);
  });

  it('cleans running headers, TOC lines and line hyphenation while preserving blank page ranges', async () => {
    const content = await readFixture(
      pdfFixture([
        ['1 | Engineering', 'First develop-', 'ment paragraph', 'Press 1'],
        ['2 | Engineering', 'Second Test-', 'Driven paragraph', 'Press 2'],
        ['3 | Engineering', 'Third paragraph', 'Contents ......... 7', 'Press 3'],
        [],
      ]),
    );
    expect(content.sections[0]?.pageEnd).toBe(4);
    expect(content.sections[0]?.text).toBe(
      'First development paragraph\n\nSecond Test-Driven paragraph\n\nThird paragraph',
    );
  });

  it('returns no sections for a PDF without extractable text', async () => {
    expect((await readFixture(pdfFixture([[]]))).sections).toEqual([]);
  });

  it('rejects corrupt PDF input', async () => {
    await expect(readFixture(Buffer.from('not a PDF'))).rejects.toThrow();
  });
});
