# Frontend Architecture

## Convention
The frontend (`apps/web`) applies Hexagonal Architecture principles where applicable. Features are grouped by context (e.g., `src/mind-map/`).
The web app must use a `presentation` layer for UI adapters (components, hooks, stores) that interact with the application/domain layers or external APIs. 
Components should be mostly dumb (presentational), delegating business rules and side effects to custom hooks or server actions.

## Benefits
- Clear separation between how things look (components) and how they work (logic/hooks).
- Makes it easier to swap out UI libraries or data-fetching strategies.
- Enforces consistency between backend and frontend directory structures (context-driven).

## Examples

### ✅ Good: Separation of Presentation adapter and UI component
```tsx
// apps/web/src/mind-map/presentation/hooks/useCreateNode.ts
export function useCreateNode() {
  return async (label: string) => {
    await fetch('/api/nodes', { method: 'POST', body: JSON.stringify({ label }) });
  };
}

// apps/web/src/mind-map/presentation/components/AddNodeForm.tsx
import { useCreateNode } from '../hooks/useCreateNode';

export function AddNodeForm() {
  const createNode = useCreateNode();
  
  return (
    <form action={async (formData) => createNode(formData.get('label'))}>
      <input name="label" required />
      <button type="submit">Add</button>
    </form>
  );
}
```

### ❌ Bad: Mixing everything in a single file
```tsx
// apps/web/src/mind-map/components/AddNodeForm.tsx
export function AddNodeForm() {
  return (
    <form action={async (formData) => {
      // ❌ API call mixed directly in the component, hard to test or reuse
      await fetch('/api/nodes', { method: 'POST', body: JSON.stringify({ label: formData.get('label') }) });
    }}>
      <input name="label" required />
      <button type="submit">Add</button>
    </form>
  );
}
```

## Real world examples
- Context root: `apps/web/src/mind-map/`
- Presentation layer: `apps/web/src/mind-map/presentation/`

## Related agreements
- [Frontend State Management](state-management.md)
