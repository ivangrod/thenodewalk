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
6. A knowledge-graph node linked to a post (`source: { kind: 'post', url }`) is a real anchor to
   `source.url`, not a clickable
   `div`. The anchor has an accessible name that includes the concept label and source action,
   a visible focus style, `target="_blank"`, and `rel="noreferrer noopener"`.
   Post-linked nodes also show a visible `Post` badge; unsourced nodes have no source badge.
7. A node without a post (`source: null`) is a `<button type="button">` that selects the
   concept on click and focus. It is never rendered as a link, and its accessible name is
   `"{label}, no linked source"`.
   A book source (`kind: 'book'`) also renders as a selectable button, with a visible `Book`
   badge and accessible name `"{label}, from the book {bookTitle}, {sectionTitle}"`.
   Absent sections are omitted; a known page is appended as `", page {pageStart}"`.
   Book nodes support click/focus selection and expose metadata without linking local files.
8. The central node (`graph.centralNodeId`) holds the main idea of the graph. The canvas places
   it in the middle and the remaining concepts on a circle around it. It is emphasized with a
   visible `Main idea` text (never by colour alone) and its accessible name includes it:
   `"{label}, main idea, open source in a new tab"` or `"{label}, main idea, no linked source"`.
   Without a known central node, every concept is placed on the circle.
9. After successful generation, every selected retrieved source appears exactly once.
   The API grounds/deduplicates sources, resolves the centre, limits depth, then attaches
   missing sources directly to the centre with a neutral `retrieved source` edge.
   Added nodes show the post title or `{bookTitle} - {sectionTitle}`. These labels identify
   provenance, not additional model-generated claims. Existing concepts remain unchanged.
   With five available selected sources (three book sections, two posts), a seven-node graph
   therefore has five sourced nodes and two unsourced concepts. Seven is an example, not a
   fixed node count: added source nodes can increase the generated graph's size.
   Empty generated graphs become source-only graphs, using the first selected source as the
   centre. Generation failures retain the explanatory empty response.

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

### ✅ Good: Lazy graph boundary and accessible concept node

```tsx
const KnowledgeGraphCanvas = dynamic(() => import('./KnowledgeGraphCanvas'), {
  ssr: false,
  loading: () => <GraphSkeleton />,
});

{
  data.source === null ? (
    <button
      aria-label={`${data.label}, no linked source`}
      type="button"
      onClick={() => select(id)}
      onFocus={() => select(id)}
    >
      {data.label}
    </button>
  ) : (
    <a
      aria-label={`${data.label}, open source in a new tab`}
      href={data.source.url}
      target="_blank"
      rel="noreferrer noopener"
      onFocus={() => select(id)}
      className="focus-visible:outline-none"
    >
      {data.label}
      <span className="mt-1 block text-xs font-semibold">Post</span>
    </a>
  );
}
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
<div onClick={() => window.open(data.source?.url)} className="cursor-pointer">
  {data.label}
</div>
```

This provides neither a semantic link nor an accessible name or guaranteed keyboard behavior.

### ❌ Bad: Linking a concept that has no post

```tsx
<a href={data.source?.url ?? '#'}>{data.label}</a>
```

A concept without a post must not pretend to be a link: use the selectable button instead.

### ✅ Good: Central node identified by text, not only by colour

```tsx
<a aria-label={`${data.label}, main idea, open source in a new tab`} href={data.source.url}>
  <span className="block text-xs font-semibold uppercase tracking-wide">Main idea</span>
  {data.label}
</a>
```

### ❌ Bad: Central node identified by colour alone

```tsx
<a className={isCentral ? 'bg-amber-300' : 'bg-card'} href={data.source.url}>
  {data.label}
</a>
```

Colour-only emphasis is invisible to screen-reader users and to users with colour-vision
deficiencies.

## Real world examples

- Request adapter: `apps/web/src/features/technical-query/infrastructure/technical-query.client.ts`
- Query state boundary: `apps/web/src/features/technical-query/presentation/hooks/useTechnicalQuery.ts`
- Interactive-only Zustand store: `apps/web/src/features/technical-query/presentation/stores/useSelectedConceptStore.ts`
- Lazy React Flow boundary: `apps/web/src/features/technical-query/presentation/components/KnowledgeGraph.tsx`
- Accessible graph node: `apps/web/src/features/technical-query/presentation/components/ConceptNode.tsx`
- Central node layout: `apps/web/src/features/technical-query/presentation/components/KnowledgeGraphCanvas.tsx`
- State rendering and retry affordance: `apps/web/src/features/technical-query/presentation/components/TechnicalQueryView.tsx`

## Related agreements

- [Frontend Architecture](frontend-architecture.md)
- [Frontend State Management](state-management.md)
- [Accessibility and UI Components](accessibility.md)
- [Performance and Dependencies](performance.md)
- [Shared Contracts](../monorepo/shared-contracts.md)

Every concept remains reachable and source-linked with 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
