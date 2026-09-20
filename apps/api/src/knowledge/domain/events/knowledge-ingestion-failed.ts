import type { DomainEvent } from '../../../shared/domain/domain-event';

/**
 * Emitted when a single feed fails to be ingested. Other feeds in the same run
 * continue to be processed.
 */
export class KnowledgeIngestionFailed implements DomainEvent {
  readonly eventName = 'knowledge.ingestion.failed';

  constructor(
    readonly feedUrl: string,
    readonly reason: string,
    readonly occurredAt: string,
  ) {}
}
