import { Injectable, Logger } from '@nestjs/common';

import type { DomainEvent } from '../../domain/domain-event';
import type { EventBus } from '../../domain/event-bus';
import type {
  DomainEventSubscriber,
  DomainEventSubscriberRegistry,
} from '../../domain/domain-event-subscriber';

/**
 * Minimal in-process {@link EventBus} adapter. It logs every published event so
 * ingestion side-effects are observable during local runs. Subscribers are awaited
 * before returning, including nested publications, so CLI shutdown cannot lose writes.
 * Failed subscribers are logged and isolated; deterministic writes can be retried.
 */
@Injectable()
export class InMemoryEventBus implements EventBus, DomainEventSubscriberRegistry {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly subscribers = new Map<string, Set<DomainEventSubscriber>>();

  register(subscriber: DomainEventSubscriber): void {
    const handlers = this.subscribers.get(subscriber.eventName) ?? new Set();
    handlers.add(subscriber);
    this.subscribers.set(subscriber.eventName, handlers);
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.logger.log(`${event.eventName} at ${event.occurredAt}`);
      for (const subscriber of this.subscribers.get(event.eventName) ?? []) {
        try {
          await subscriber.handle(event);
        } catch (error) {
          this.logger.error(
            `Subscriber failed for ${event.eventName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
}
