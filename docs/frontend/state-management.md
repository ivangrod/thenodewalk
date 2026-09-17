# Frontend State Management

## Convention
Server state must remain close to its data boundary (e.g., fetched via Next.js Server Components or a data-fetching library that caches it). You must **only** use Zustand for shared, interactive client state (e.g., drag-and-drop state, UI toggles, active node selections). Do not use Zustand to cache REST API responses or duplicate server data.

## Benefits
- Prevents out-of-sync data bugs by relying on the server as the source of truth for persisted data.
- Keeps the Zustand store small, predictable, and strictly related to UI interaction.
- Leverages Next.js's native caching and data fetching mechanisms for better performance.

## Examples

### ✅ Good: Zustand only for UI interaction state
```typescript
import { create } from 'zustand';

interface MapUiState {
  selectedNodeId: string | null;
  isDragging: boolean;
  setSelectedNode: (id: string | null) => void;
}

export const useMapUiStore = create<MapUiState>((set) => ({
  selectedNodeId: null,
  isDragging: false,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
}));
```

### ❌ Bad: Zustand storing server responses
```typescript
import { create } from 'zustand';

interface MapDataState {
  nodes: Node[]; // ❌ Server data duplicated in client store
  fetchNodes: () => Promise<void>; 
}

export const useMapDataStore = create<MapDataState>((set) => ({
  nodes: [],
  fetchNodes: async () => {
    const res = await fetch('/api/nodes');
    set({ nodes: await res.json() });
  },
}));
```

## Real world examples
- UI State Store: `apps/web/src/mind-map/presentation/stores/useMapUiStore.ts`
- Server Data Fetching: `apps/web/src/app/maps/[id]/page.tsx`

## Related agreements
- [Frontend Architecture](frontend-architecture.md)
