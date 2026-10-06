import { Module } from '@nestjs/common';

import { EVENT_BUS, EVENT_SUBSCRIBER_REGISTRY } from '../application/event-bus.token';
import { InMemoryEventBus } from './event-bus/in-memory-event-bus';
import { PrismaService } from './persistence/prisma/prisma.service';

/**
 * Provides the shared event bus, subscriber registry and lazy Prisma client.
 */
@Module({
  providers: [
    InMemoryEventBus,
    PrismaService,
    { provide: EVENT_BUS, useExisting: InMemoryEventBus },
    { provide: EVENT_SUBSCRIBER_REGISTRY, useExisting: InMemoryEventBus },
  ],
  exports: [EVENT_BUS, EVENT_SUBSCRIBER_REGISTRY, PrismaService],
})
export class SharedModule {}
