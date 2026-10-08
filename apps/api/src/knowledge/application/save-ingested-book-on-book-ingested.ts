import { Injectable } from '@nestjs/common';

import type { DomainEvent } from '../../shared/domain/domain-event';
import type { DomainEventSubscriber } from '../../shared/domain/domain-event-subscriber';
import { BookIngested } from '../domain/events/book-ingested';
import { SaveIngestedBookCommand } from './save-ingested-book.command';

@Injectable()
export class SaveIngestedBookOnBookIngested implements DomainEventSubscriber {
  readonly eventName = 'knowledge.book.ingested';

  constructor(private readonly command: SaveIngestedBookCommand) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!(event instanceof BookIngested)) return;
    await this.command.execute({
      bookId: event.bookId,
      filePath: event.filePath,
      title: event.title,
      chunkCount: event.chunkCount,
      ingestedAt: event.occurredAt,
    });
  }
}
