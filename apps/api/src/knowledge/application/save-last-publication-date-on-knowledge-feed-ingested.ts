import { Injectable } from '@nestjs/common';

import type { DomainEvent } from '../../shared/domain/domain-event';
import type { DomainEventSubscriber } from '../../shared/domain/domain-event-subscriber';
import { KnowledgeFeedIngested } from '../domain/events/knowledge-feed-ingested';
import { SaveLastPublicationDateCommand } from './save-last-publication-date.command';

@Injectable()
export class SaveLastPublicationDateOnKnowledgeFeedIngested implements DomainEventSubscriber {
  readonly eventName = 'knowledge.feed.ingested';

  constructor(private readonly command: SaveLastPublicationDateCommand) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!(event instanceof KnowledgeFeedIngested)) return;
    await this.command.execute({
      blogName: event.blogName,
      feedUrl: event.feedUrl,
      lastPublishedAt: event.lastPublishedAt,
    });
  }
}
