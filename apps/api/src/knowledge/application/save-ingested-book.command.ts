import { Inject, Injectable } from '@nestjs/common';

import { EVENT_BUS } from '../../shared/application/event-bus.token';
import type { EventBus } from '../../shared/domain/event-bus';
import { IngestedBookSaved } from '../domain/events/ingested-book-saved';
import type { IngestedBookPrimitives } from '../domain/ingested-book';
import type { IngestedBookRepository } from '../domain/ingested-book-repository';
import { INGESTED_BOOK_REPOSITORY } from './knowledge.tokens';

@Injectable()
export class SaveIngestedBookCommand {
  constructor(
    @Inject(INGESTED_BOOK_REPOSITORY) private readonly repository: IngestedBookRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async execute(book: IngestedBookPrimitives): Promise<void> {
    await this.repository.save(book);
    await this.eventBus.publish([new IngestedBookSaved(book.bookId, new Date().toISOString())]);
  }
}
