import type { BookContent, BookContentReader, BookFile } from '../../domain/book-content-reader';
import type { BookLibraryReader } from '../../domain/book-library-reader';
import type { IngestedBook } from '../../domain/ingested-book';
import type { IngestedBookRepository } from '../../domain/ingested-book-repository';

export class InMemoryIngestedBookRepository implements IngestedBookRepository {
  readonly store = new Map<string, IngestedBook>();
  findAllIdsCalls = 0;
  findAllIds(): Promise<Set<string>> {
    this.findAllIdsCalls++;
    return Promise.resolve(new Set(this.store.keys()));
  }
  save(book: IngestedBook): Promise<void> {
    this.store.set(book.bookId, book);
    return Promise.resolve();
  }
}
import type {
  BookIngestionProgress,
  BookIngestionProgressReporter,
} from '../../domain/book-ingestion-progress-reporter';

export class StubBookLibraryReader implements BookLibraryReader {
  constructor(
    readonly books: BookFile[],
    readonly unsupported: string[] = [],
  ) {}
  list(): Promise<{ books: BookFile[]; unsupported: string[] }> {
    return Promise.resolve({ books: this.books, unsupported: this.unsupported });
  }
}

export class StubBookContentReader implements BookContentReader {
  constructor(readonly contents: Map<string, BookContent | Error>) {}
  read(file: BookFile): Promise<BookContent> {
    const content = this.contents.get(file.filePath);
    if (!content || content instanceof Error)
      return Promise.reject(content ?? new Error('Missing book'));
    return Promise.resolve(content);
  }
}

export class RecordingBookProgress implements BookIngestionProgressReporter {
  readonly reports: { status: string; progress: BookIngestionProgress }[] = [];
  bookStarted(progress: BookIngestionProgress): void {
    this.reports.push({ status: 'started', progress });
  }
  bookCompleted(progress: BookIngestionProgress): void {
    this.reports.push({ status: 'completed', progress });
  }
  bookFailed(progress: BookIngestionProgress): void {
    this.reports.push({ status: 'failed', progress });
  }
}
