# Technical Query Knowledge Graph Interface

## Convention

The `technical-query` feature presents the shared `TechnicalQueryResponse` returned by
`POST /technical-queries`. The HTTP adapter and `useTechnicalQuery` own server state;
Zustand holds only the selected concept id. Modal state is local to the canvas.

1. Render `d3-graph-react` behind `next/dynamic` with `ssr: false` and a fixed-height
   skeleton. Translate contract edge ids into the library's numeric node indices;
   omit edges whose endpoints are absent.
2. Use a wide two-column `/ask` layout: heading, explanation, form and answer summary
   on the left, with the larger graph workspace on the right. Stack panels on mobile.
   Style the workspace like the library's PersonCard demo: dark dotted canvas, compact
   cards with coloured initial badges and a secondary label. Share the scoped dark
   palette with the article modal.
   Pin only the main idea at the centre. Configure repulsion, link, collision and
   centring forces; compute the initial layout with stopped synchronous ticks to avoid
   animated motion on load. Nodes can be dragged, after which the simulation settles
   rather than moving perpetually. Pointer pan/zoom and keyboard-operable zoom/reset
   controls remain available.
3. Nodes are semantic buttons. Focus selects a concept; clicking or pressing Enter/Space
   opens article details only for nodes with `sourceUrl`. The main idea has a visible
   text label; source availability is never conveyed by colour alone.
4. Render one Radix modal outside the SVG, using the same Tailwind card, primary, border
   and foreground tokens as the graph. Include article title, origin, publication date,
   close control and a real `Go to…` anchor with `target="_blank"` and
   `rel="noopener noreferrer"`. Allow only HTTP (S) navigation.
5. The modal traps focus, closes on Escape and restores focus to its triggering node.
   Replacing the graph closes stale article details. Missing metadata has explicit
   unavailable labels, including for responses from older APIs.
6. Use `node.source` from the API for provenance. Never infer the title from the concept
   label, the origin from the URL, or the publication date from the current time.
7. Show directed relationships and their labels in the graph; do not add a separate
   relationship panel. Keep concept buttons keyboard-accessible.

### Library integration

`d3-graph-react@1.3.1` declares React 18 peers; this integration is verified with React
19.1.1 through TypeScript, a Next.js production build and real-library browser tests.
The upstream peer range is still unchanged. Recheck compatibility when upgrading.

The committed pnpm patch replaces the library's Tailwind 3 global reset and utilities
with two `.knowledge-graph`-scoped rules needed by its `foreignObject` wrappers.
The application supplies all node, link, container and modal styles through Tailwind 4.
Keep the patch when upgrading unless upstream removes its global stylesheet.

## Benefits

- Source details stay grounded in indexed metadata without another request or LLM call.
- Native buttons and a focus-managed modal support keyboard and screen-reader users.
- Lazy loading keeps visualization code out of the initial `/ask` bundle; the reserved
  canvas height prevents layout shifts. The initial layout is resolved without animated
  motion and the simulation does not run perpetually.
- Scoped dependency CSS protects styles throughout the application.

## Examples

### ✅ Good: Article provenance supplied by the API

```typescript
const node = {
  id: 'caching',
  label: 'Caching',
  type: 'concept',
  sourceUrl: 'https://engineering.example.com/caching',
  source: {
    articleTitle: 'How we cache our API',
    blogName: 'Netflix',
    publishedAt: '2026-01-02T00:00:00.000Z',
  },
};
```

### ✅ Good: Lazy canvas

```tsx
const KnowledgeGraphCanvas = dynamic(() => import('./KnowledgeGraphCanvas'), {
  ssr: false,
  loading: () => <GraphSkeleton />,
});
```

### ❌ Bad: Pointer-only source activation and invented provenance

```tsx
<div onClick={() => window.open(node.sourceUrl)}>{node.label}</div>
// Do not display `new Date()` as the article's publication date.
```

## Real world examples

- Lazy boundary: `apps/web/src/features/technical-query/presentation/components/KnowledgeGraph.tsx`
- D3 adapter, layout, controls and modal state:
  `apps/web/src/features/technical-query/presentation/components/KnowledgeGraphCanvas.tsx`
- Semantic node: `apps/web/src/features/technical-query/presentation/components/ConceptNode.tsx`
- Article modal: `apps/web/src/features/technical-query/presentation/components/ArticleSourceDialog.tsx`
- Dependency CSS isolation: `patches/d3-graph-react@1.3.1.patch`
- Real renderer, keyboard and axe checks: `apps/web/e2e/technical-query.spec.ts`

## Related agreements

- [Frontend Architecture](frontend-architecture.md)
- [Frontend State Management](state-management.md)
- [Accessibility](accessibility.md)
- [Performance](performance.md)
- [Shared Contracts](../monorepo/shared-contracts.md)
