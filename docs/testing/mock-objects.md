# Mock Objects for Testing

## Convention
In unit tests, use hand-written implementations of domain interfaces or `jest.fn()` wrappers. Avoid complex third-party mocking libraries. Mocks should reside in `tests/` or `infrastructure/testing/` directories close to their domain.

## Benefits
- Tests verify behavior through domain contracts.
- Hand-written mocks are reusable across all tests for the same aggregate.

## Examples

### ✅ Good: Explicit Jest Mock
```typescript
export class MockNodeRepository implements NodeRepository {
  readonly saveMock = jest.fn();
  readonly findByIdMock = jest.fn();

  async save(node: MindMapNode): Promise<void> {
    this.saveMock(node);
  }

  async findById(id: string): Promise<MindMapNode | null> {
    return this.findByIdMock(id);
  }
}
```
