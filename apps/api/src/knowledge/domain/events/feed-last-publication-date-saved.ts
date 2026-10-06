import type { DomainEvent } from '../../../shared/domain/domain-event';

export class FeedLastPublicationDateSaved implements DomainEvent {
  readonly eventName = 'knowledge.feed.last-publication-date.saved';

  constructor(
    readonly blogName: string,
    readonly lastPublishedAt: string,
    readonly occurredAt: string,
  ) {}
}
