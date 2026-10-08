import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FsBookLibraryReader } from './fs-book-library.reader';

describe('FsBookLibraryReader', () => {
  it('lists EPUB/PDF recursively with first-level categories and unsupported extensions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tnw-books-'));
    try {
      await mkdir(join(root, 'AGILE', 'TDD'), { recursive: true });
      for (const path of [
        'root.epub',
        'AGILE/TDD/book.EPUB',
        'AGILE/book.pdf',
        'book.mobi',
        '.DS_Store',
      ])
        await writeFile(join(root, path), 'fixture');
      const result = await new FsBookLibraryReader().list(root);
      expect(result.books).toEqual(
        expect.arrayContaining([
          { filePath: join(root, 'root.epub'), format: 'epub', category: null },
          { filePath: join(root, 'AGILE/TDD/book.EPUB'), format: 'epub', category: 'AGILE' },
          { filePath: join(root, 'AGILE/book.pdf'), format: 'pdf', category: 'AGILE' },
        ]),
      );
      expect(result.books).toHaveLength(3);
      expect(result.unsupported).toEqual([join(root, 'book.mobi')]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
