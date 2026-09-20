import { Injectable, Logger } from '@nestjs/common';

import type { DomainEvent } from '../../domain/domain-event';
import type { EventBus } from '../../domain/event-bus';

/**
 * Minimal in-process {@link EventBus} adapter. It logs every published event so
 * ingestion side-effects are observable during local runs. Asynchronous
 * subscribers can be introduced later without touching the application layer.
 */
@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);

  publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.logger.log(`${event.eventName} at ${event.occurredAt}`);
    }

    return Promise.resolve();
  }
}
