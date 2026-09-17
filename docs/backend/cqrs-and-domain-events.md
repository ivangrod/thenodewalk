# CQRS and Domain Events

## Convention
The application layer must be strictly divided into **Commands** (actions that modify state) and **Queries** (actions that read state). 

- **Commands:** Must perform the state modification and **always emit at least one Domain Event** that must be captured by the application event bus.
- **Queries:** Must only read and return data. They must **never** emit Domain Events or modify the state of the application.

## Benefits
- Clear separation of side-effects: you always know which operations change the system and which are safe to call repeatedly.
- Reactive architecture: Domain events allow decoupling side-effects (like sending an email or updating a read-model) from the main transaction.
- AI agents can easily understand the intent of a use case based on its type (Command vs Query).

## Examples

### ✅ Good: Command emitting a domain event
```typescript
export class CreateNodeCommand {
  constructor(
    private readonly repository: NodeRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(id: string, label: string): Promise<void> {
    const node = MindMapNode.create(id, label);
    await this.repository.save(node);
    
    // Command emits domain event captured by the application
    await this.eventBus.publish(node.pullDomainEvents());
  }
}
```

### ✅ Good: Query safely reading data without events
```typescript
export class FindNodeQuery {
  constructor(private readonly repository: NodeRepository) {}

  async execute(id: string): Promise<NodeResponse> {
    const node = await this.repository.findById(id);
    return NodeResponse.fromAggregate(node);
  }
}
```

### ❌ Bad: Query emitting an event or modifying state
```typescript
export class FindNodeQuery {
  constructor(
    private readonly repository: NodeRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(id: string): Promise<NodeResponse> {
    const node = await this.repository.findById(id);
    node.incrementViews(); // Modifying state in a Query!
    await this.repository.save(node);
    await this.eventBus.publish(new NodeViewedEvent(id)); // Emitting event in a Query!
    return NodeResponse.fromAggregate(node);
  }
}
```

## Related agreements
- [Hexagonal Architecture](hexagonal-architecture.md)
