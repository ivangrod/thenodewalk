import type { DomainEvent } from '../../../shared/domain/domain-event';

export class IngestedBookSaved implements DomainEvent {
  readonly eventName = 'knowledge.ingested-book.saved';

  constructor(
    readonly bookId: string,
    readonly occurredAt: string,
  ) {}
}
