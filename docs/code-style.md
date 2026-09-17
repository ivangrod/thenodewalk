# Code Style Convention

## Convention
The project uses strict TypeScript across the monorepo. Key rules enforced:
- `@typescript-eslint/explicit-function-return-type: error` - every function must declare its return type.
- TypeScript `strict: true` in `tsconfig.json`.
- Code formatting is handled by Prettier.

Lint issues and formatting are checked with `pnpm lint` and `pnpm format:check`. The full check suite runs with `pnpm typecheck` and `pnpm lint:architecture` to ensure hexagonal boundaries are respected.

## Benefits
- Explicit return types make function contracts clear and catch unintended type changes at compile time.
- Strict mode eliminates entire categories of runtime bugs (null/undefined, implicit any).
- A shared preset ensures all team members and AI agents produce consistent code style.
- Automated architecture linting (`lint:architecture`) prevents dependency leaks between layers.

## Examples

### ✅ Good: Function with explicit return type
```typescript
async findMap(id: string): Promise<MindMapPrimitives | null> {
  const map = await this.repository.findById(id);
  return map ? map.toPrimitives() : null;
}
```

### ❌ Bad: Function without return type
```typescript
async findMap(id: string) {
  const map = await this.repository.findById(id);
  return map ? map.toPrimitives() : null;
}
```

## Real world examples
- Formatter config: `.prettierrc`
- TypeScript config: `packages/typescript-config/tsconfig.json`

## Related agreements
- [Hexagonal Architecture](backend/hexagonal-architecture.md)
