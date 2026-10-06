import { Inject, Injectable } from '@nestjs/common';

import { EVENT_BUS } from '../../shared/application/event-bus.token';
import type { EventBus } from '../../shared/domain/event-bus';
import { FeedLastPublicationDateSaved } from '../domain/events/feed-last-publication-date-saved';
import type { FeedLastPublicationDate } from '../domain/feed-last-publication-date';
import type { FeedLastPublicationDateRepository } from '../domain/feed-last-publication-date-repository';
import { FEED_LAST_PUBLICATION_DATE_REPOSITORY } from './knowledge.tokens';

@Injectable()
export class SaveLastPublicationDateCommand {
  constructor(
    @Inject(FEED_LAST_PUBLICATION_DATE_REPOSITORY)
    private readonly repository: FeedLastPublicationDateRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async execute(record: FeedLastPublicationDate & { feedUrl: string }): Promise<void> {
    await this.repository.save(record);
    await this.eventBus.publish([
      new FeedLastPublicationDateSaved(
        record.blogName,
        record.lastPublishedAt,
        new Date().toISOString(),
      ),
    ]);
  }
}
