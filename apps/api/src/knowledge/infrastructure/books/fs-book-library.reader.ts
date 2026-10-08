import { readdir } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

import type { BookFile } from '../../domain/book-content-reader';
import type { BookLibraryReader } from '../../domain/book-library-reader';

export class FsBookLibraryReader implements BookLibraryReader {
  async list(booksDir: string): Promise<{ books: BookFile[]; unsupported: string[] }> {
    const root = resolve(booksDir);
    const books: BookFile[] = [];
    const unsupported: string[] = [];
    const visit = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const filePath = join(directory, entry.name);
        if (entry.isDirectory()) await visit(filePath);
        else if (entry.isFile()) {
          const extension = extname(entry.name).toLowerCase();
          if (extension !== '.epub' && extension !== '.pdf') {
            unsupported.push(filePath);
            continue;
          }
          const parts = relative(root, filePath).split(sep);
          books.push({
            filePath,
            format: extension === '.epub' ? 'epub' : 'pdf',
            category: parts.length > 1 ? (parts[0] ?? null) : null,
          });
        }
      }
    };
    await visit(root);
    return { books, unsupported };
  }
}
