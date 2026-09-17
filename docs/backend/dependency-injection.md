# Dependency Injection with NestJS

## Convention
Use NestJS's native Dependency Injection (`@Injectable()`, `@Inject()`, and Modules) while respecting Hexagonal Architecture boundaries. 
- **Domain Layer:** Must remain 100% pure. Never use `@Injectable()` or any NestJS imports here.
- **Application Layer (Use Cases):** Can be decorated with `@Injectable()` for convenience, but they must depend on **interfaces** (ports), not concrete implementations.
- **Infrastructure Layer:** Defines the concrete implementations (adapters) and uses NestJS `Modules` to map the domain interfaces to their concrete classes using Custom Providers (e.g., `useClass`).

Since TypeScript interfaces don't exist at runtime, you must use **Injection Tokens** (strings or Symbols) to inject ports (like Repositories) into your Use Cases.

## Benefits
- Keeps the Domain and Application layers decoupled from database or external API specifics.
- Makes it trivial to swap implementations (e.g., swapping a Prisma repository for an in-memory repository during testing).
- Leverages the robust DI system already built into NestJS without violating architectural boundaries.

## Examples

### ✅ Good: Using Injection Tokens for Domain Interfaces
```typescript
// 1. Application Layer: Use Case depends on an interface via a token
import { Injectable, Inject } from '@nestjs/common';
import { NodeRepository } from '../../domain/NodeRepository';

export const NODE_REPOSITORY_TOKEN = 'NODE_REPOSITORY_TOKEN';

@Injectable()
export class CreateNodeCommand {
  constructor(
    @Inject(NODE_REPOSITORY_TOKEN)
    private readonly repository: NodeRepository
  ) {}

  async execute(id: string, label: string): Promise<void> {
    // ...
  }
}
```

```typescript
// 2. Infrastructure Layer: Module binds the token to the concrete Prisma implementation
import { Module } from '@nestjs/common';
import { CreateNodeCommand, NODE_REPOSITORY_TOKEN } from '../../application/CreateNodeCommand';
import { PrismaNodeRepository } from './PrismaNodeRepository';

@Module({
  providers: [
    CreateNodeCommand,
    {
      provide: NODE_REPOSITORY_TOKEN,
      useClass: PrismaNodeRepository,
    },
  ],
  controllers: [NodeController],
})
export class NodeModule {}
```

### ❌ Bad: Coupling Application directly to Infrastructure
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaNodeRepository } from '../../infrastructure/PrismaNodeRepository'; // ❌ Infrastructure leak!

@Injectable()
export class CreateNodeCommand {
  // ❌ Depending on a concrete implementation instead of an interface
  constructor(private readonly repository: PrismaNodeRepository) {}
}
```

## Real world examples
- Interface definition: `apps/api/src/mind-map/domain/NodeRepository.ts`
- Application command: `apps/api/src/mind-map/application/CreateNodeCommand.ts`
- Module configuration: `apps/api/src/mind-map/infrastructure/MindMapModule.ts`

## Related agreements
- [Hexagonal Architecture](hexagonal-architecture.md)
- [CQRS and Domain Events](cqrs-and-domain-events.md)
