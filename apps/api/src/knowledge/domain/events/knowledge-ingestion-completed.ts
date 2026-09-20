import type { DomainEvent } from '../../../shared/domain/domain-event';

/**
 * Emitted when a feed-ingestion run finishes, carrying the run totals.
 */
export class KnowledgeIngestionCompleted implements DomainEvent {
  readonly eventName = 'knowledge.ingestion.completed';

  constructor(
    readonly processedFeeds: number,
    readonly processedArticles: number,
    readonly indexedChunks: number,
    readonly occurredAt: string,
  ) {}
}
