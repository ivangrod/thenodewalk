import type { BookFile } from './book-content-reader';

export interface BookLibraryReader {
  list(booksDir: string): Promise<{ books: BookFile[]; unsupported: string[] }>;
}
