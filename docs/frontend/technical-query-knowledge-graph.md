# Technical Query Knowledge Graph Interface

## Convention

The `technical-query` feature presents the RAG answer returned by `POST /technical-queries`.
It consumes the shared `TechnicalQueryRequest` and `TechnicalQueryResponse` contracts and
keeps responsibilities separated:

1. The HTTP call belongs in `infrastructure/technical-query.client.ts`.
2. `useTechnicalQuery` owns request status, the latest server response, and the retry query at
   the presentation data boundary. Do not put the API response in Zustand.
3. Zustand may hold shared interactive-only graph state, such as the selected concept id.
4. The view renders distinct idle, loading, recoverable-error, no-results, and success states.
5. React Flow is a heavy browser-only dependency. It must remain behind a `next/dynamic`
   boundary with `ssr: false` and a lightweight loading skeleton.
6. Every knowledge-graph node is a real anchor to its `sourceUrl`, not a clickable `div`. The
   anchor has an accessible name that includes the concept label and source action, a visible
   focus style, `target="_blank"`, and `rel="noreferrer noopener"`.

The graph canvas is an enhancement for the structured response. The summary and query-state
messages remain readable regardless of whether the graph has nodes.

## Benefits

- Keeps REST state close to the code that requests it, avoiding stale duplicate stores.
- Restricts Zustand to interaction state that is not persisted by the server.
- Prevents React Flow from increasing the `/ask` initial bundle or being rendered on the server.
- Makes source navigation available to keyboard and screen-reader users.
- Gives users useful feedback while retrieval/generation is running, empty, or recoverable.
- Preserves provenance from the RAG graph through the visible UI.

## Examples

### ✅ Good: Server state in a hook, UI state in Zustand

```tsx
export function useTechnicalQuery(): UseTechnicalQuery {
  const [data, setData] = useState<TechnicalQueryResponse | null>(null);
  const [status, setStatus] = useState<TechnicalQueryStatus>('idle');

  const ask = useCallback(async (query: string): Promise<void> => {
    setStatus('loading');
    try {
      setData(await requestTechnicalQuery(query));
      setStatus('success');
    } catch {
      setData(null);
      setStatus('error');
    }
  }, []);

  return { ask, data, status, lastQuery };
}

export const useSelectedConceptStore = create<SelectedConceptState>((set) => ({
  selectedNodeId: null,
  select: (nodeId) => set({ selectedNodeId: nodeId }),
}));
```

### ✅ Good: Lazy graph boundary and accessible source link

```tsx
const KnowledgeGraphCanvas = dynamic(() => import('./KnowledgeGraphCanvas'), {
  ssr: false,
  loading: () => <GraphSkeleton />,
});

<a
  aria-label={`${data.label}, open source in a new tab`}
  href={data.sourceUrl}
  target="_blank"
  rel="noreferrer noopener"
  onFocus={() => select(id)}
  className="focus-visible:outline-none"
>
  {data.label}
</a>;
```

### ❌ Bad: Caching the response in Zustand and importing React Flow eagerly

```tsx
import ReactFlow from '@xyflow/react'; // Included in the initial bundle.

const useGraphStore = create((set) => ({
  response: null,
  ask: async (query: string) => {
    const response = await fetch('/technical-queries', { method: 'POST' });
    set({ response: await response.json() }); // Server data duplicated in Zustand.
  },
}));
```

### ❌ Bad: Non-semantic node interaction

```tsx
<div onClick={() => window.open(data.sourceUrl)} className="cursor-pointer">
  {data.label}
</div>
```

This provides neither a semantic link nor an accessible name or guaranteed keyboard behavior.

## Real world examples

- Request adapter: `apps/web/src/features/technical-query/infrastructure/technical-query.client.ts`
- Query state boundary: `apps/web/src/features/technical-query/presentation/hooks/useTechnicalQuery.ts`
- Interactive-only Zustand store: `apps/web/src/features/technical-query/presentation/stores/useSelectedConceptStore.ts`
- Lazy React Flow boundary: `apps/web/src/features/technical-query/presentation/components/KnowledgeGraph.tsx`
- Accessible graph node: `apps/web/src/features/technical-query/presentation/components/ConceptNode.tsx`
- State rendering and retry affordance: `apps/web/src/features/technical-query/presentation/components/TechnicalQueryView.tsx`

## Related agreements

- [Frontend Architecture](frontend-architecture.md)
- [Frontend State Management](state-management.md)
- [Accessibility and UI Components](accessibility.md)
- [Performance and Dependencies](performance.md)
- [Shared Contracts](../monorepo/shared-contracts.md)

Every concept remains reachable and source-linked with 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
