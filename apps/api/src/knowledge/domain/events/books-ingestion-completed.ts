import type { DomainEvent } from '../../../shared/domain/domain-event';

export class BooksIngestionCompleted implements DomainEvent {
  readonly eventName = 'knowledge.books.ingestion.completed';

  constructor(
    readonly processedBooks: number,
    readonly indexedChunks: number,
    readonly occurredAt: string,
  ) {}
}
