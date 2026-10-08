import {
  UnsupportedBookFormatError,
  type BookContent,
  type BookContentReader,
  type BookFile,
} from '../../domain/book-content-reader';

export class CompositeBookContentReader implements BookContentReader {
  constructor(private readonly epub: BookContentReader) {}

  read(file: BookFile): Promise<BookContent> {
    if (file.format === 'epub') return this.epub.read(file);
    return Promise.reject(new UnsupportedBookFormatError(file.format));
  }
}
