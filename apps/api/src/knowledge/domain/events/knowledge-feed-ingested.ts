import type { DomainEvent } from '../../../shared/domain/domain-event';

/** One event per feed, after its chunks have been stored successfully. */
export class KnowledgeFeedIngested implements DomainEvent {
  readonly eventName = 'knowledge.feed.ingested';

  constructor(
    readonly blogName: string,
    readonly feedUrl: string,
    readonly lastPublishedAt: string,
    readonly occurredAt: string,
  ) {}
}
