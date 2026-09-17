# Shared Contracts Management

## Convention
All interfaces, types, Data Transfer Objects (DTOs), and validation schemas shared across the network boundary (between `apps/web` and `apps/api`) must live in the `packages/contracts` workspace. 
You must not duplicate types across applications. Both frontend and backend applications must import these contracts as a standard workspace package (e.g., `@thenodewalk/contracts`).

## Benefits
- **End-to-end type safety:** Changes in the API payload immediately trigger TypeScript errors in the frontend if contracts are broken.
- **Single source of truth:** Eliminates the mental overhead of keeping UI interfaces in sync with API schemas.
- **Clean boundaries:** Prevents circular dependencies or direct imports between `apps/web` and `apps/api`.

## Examples

### ✅ Good: Using shared contracts
```typescript
// packages/contracts/src/nodes/NodeDto.ts
export interface NodeDto {
  id: string;
  label: string;
}

// apps/api/src/mind-map/infrastructure/NodeController.ts
import { NodeDto } from '@thenodewalk/contracts';
// Controller uses NodeDto for its return type or body

// apps/web/src/mind-map/presentation/hooks/useNodes.ts
import { NodeDto } from '@thenodewalk/contracts';
// Frontend uses NodeDto to type the fetch response
```

### ❌ Bad: Duplicating types in both apps
```typescript
// apps/api/src/mind-map/infrastructure/dto/NodeDto.ts
export interface NodeDto { id: string; label: string; }

// apps/web/src/types/Node.ts 
// ❌ Duplicated type. If the API changes, the frontend won't know until runtime.
export interface Node { id: string; label: string; }
```

## Real world examples
- Contracts package: `packages/contracts/package.json`
- Node contracts: `packages/contracts/src/mind-map/node.dto.ts`

## Related agreements
- [Hexagonal Architecture](../backend/hexagonal-architecture.md)
