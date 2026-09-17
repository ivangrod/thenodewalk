# Object Mothers for Testing

## Convention
Use the Object Mother pattern to instantiate aggregates and value objects in tests. Each aggregate has a corresponding `*Mother` class. Use `@faker-js/faker` for random data generation and accept an optional `Partial<Primitives>` parameter to override specific fields.

## Benefits
- Test data creation is centralized, avoiding duplication.
- Random data exposes hidden assumptions and coupling to specific values.

## Examples

### ✅ Good: Object Mother with Faker
```typescript
import { faker } from "@faker-js/faker";

export class NodeMother {
  static create(params?: Partial<NodePrimitives>): MindMapNode {
    const primitives = {
      id: faker.string.uuid(),
      label: faker.lorem.words(2),
      ...params,
    };
    return MindMapNode.fromPrimitives(primitives);
  }
}
```
