import type { DomainEvent } from '../../../shared/domain/domain-event';

export class BookIngested implements DomainEvent {
  readonly eventName = 'knowledge.book.ingested';

  constructor(
    readonly bookId: string,
    readonly title: string,
    readonly filePath: string,
    readonly chunkCount: number,
    readonly occurredAt: string,
  ) {}
}
