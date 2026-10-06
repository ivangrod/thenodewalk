import { Logger } from '@nestjs/common';

import type { DomainEvent } from '../../domain/domain-event';
import { InMemoryEventBus } from './in-memory-event-bus';

const event: DomainEvent = { eventName: 'test.event', occurredAt: '2026-01-01T00:00:00Z' };

describe('InMemoryEventBus', () => {
  it('awaits matching subscribers and their nested publications before returning', async () => {
    const bus = new InMemoryEventBus();
    const handled: string[] = [];
    bus.register({
      eventName: 'nested.event',
      handle: async (): Promise<void> => {
        await Promise.resolve();
        handled.push('nested');
      },
    });
    const subscriber = {
      eventName: event.eventName,
      handle: async (): Promise<void> => {
        await bus.publish([{ ...event, eventName: 'nested.event' }]);
        handled.push('outer');
      },
    };
    bus.register(subscriber);
    bus.register(subscriber);
    bus.register({
      eventName: 'unmatched',
      handle: async (): Promise<void> => {
        handled.push('wrong');
      },
    });
    await bus.publish([event]);
    expect(handled).toEqual(['nested', 'outer']);
  });

  it('reports failures and still awaits remaining subscribers', async () => {
    const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => {});
    const handled = jest.fn(async (): Promise<void> => {});
    const bus = new InMemoryEventBus();
    bus.register({
      eventName: event.eventName,
      handle: async (): Promise<void> => {
        throw new Error('write failed');
      },
    });
    bus.register({ eventName: event.eventName, handle: handled });
    await bus.publish([event]);
    expect(handled).toHaveBeenCalledWith(event);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('write failed'));
    errors.mockRestore();
  });
});
