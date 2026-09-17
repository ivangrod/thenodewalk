# Hexagonal Architecture

## Convention
The backend (NestJS in `apps/api`) follows Hexagonal Architecture. Code is organized in three layers per functional context:
- **Domain:** Aggregates, Value Objects, Repository interfaces, Domain Events. **Must not import frameworks (NestJS, Prisma, network adapters)**.
- **Application:** Use cases (Commands and Queries). Orchestrates domain objects and ports.
- **Infrastructure:** Implementations of domain interfaces (NestJS controllers, Prisma repositories). Framework and library aware.

Directory structure:
`apps/api/src/{context}/`
  `domain/`          # Aggregates, interfaces, events
  `application/`     # Commands, Queries
  `infrastructure/`  # Controllers, Prisma adapters, NestJS modules

## Benefits
- Domain logic stays framework-agnostic and independently testable.
- Swapping infrastructure (e.g. from PostgreSQL to another DB) requires no domain changes.
- Automated validation via `pnpm lint:architecture`.

## Examples

### ✅ Good: Domain strictly isolated
```typescript
// apps/api/src/mind-map/domain/NodeRepository.ts
import { MindMapNode } from "./MindMapNode";

export interface NodeRepository {
  save(node: MindMapNode): Promise<void>;
  findById(id: string): Promise<MindMapNode | null>;
}
```

### ❌ Bad: Domain coupled to Prisma
```typescript
// apps/api/src/mind-map/domain/NodeRepository.ts
import { PrismaClient } from "@prisma/client"; // Infrastructure leak!

export class NodeRepository {
  constructor(private prisma: PrismaClient) {}
}
```

## Related agreements
- [CQRS and Domain Events](cqrs-and-domain-events.md)
- [Dependency Injection](dependency-injection.md)
