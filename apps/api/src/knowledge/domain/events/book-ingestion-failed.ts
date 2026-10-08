import type { DomainEvent } from '../../../shared/domain/domain-event';

export class BookIngestionFailed implements DomainEvent {
  readonly eventName = 'knowledge.book.ingestion.failed';

  constructor(
    readonly filePath: string,
    readonly reason: string,
    readonly occurredAt: string,
  ) {}
}
