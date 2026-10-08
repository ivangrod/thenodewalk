import type { IngestedBook } from './ingested-book';

export interface IngestedBookRepository {
  findAllIds(): Promise<Set<string>>;
  save(book: IngestedBook): Promise<void>;
}
