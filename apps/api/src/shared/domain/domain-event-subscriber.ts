import type { DomainEvent } from './domain-event';

export interface DomainEventSubscriber {
  readonly eventName: string;
  handle(event: DomainEvent): Promise<void>;
}

export interface DomainEventSubscriberRegistry {
  register(subscriber: DomainEventSubscriber): void;
}
