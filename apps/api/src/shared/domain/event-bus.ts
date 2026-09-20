import type { DomainEvent } from './domain-event';

/**
 * Application event bus port. Commands publish the domain events they produce so
 * that side-effects can be handled without coupling the use case to them.
 */
export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
}
