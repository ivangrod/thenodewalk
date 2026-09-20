import { Module } from '@nestjs/common';

import { EVENT_BUS } from '../application/event-bus.token';
import { InMemoryEventBus } from './event-bus/in-memory-event-bus';

/**
 * Provides cross-context infrastructure. For now it only exposes the
 * application {@link EventBus} implementation bound to its injection token.
 */
@Module({
  providers: [{ provide: EVENT_BUS, useClass: InMemoryEventBus }],
  exports: [EVENT_BUS],
})
export class SharedModule {}
