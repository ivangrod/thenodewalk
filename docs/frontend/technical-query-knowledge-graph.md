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
   Place the main idea at the centre and order the other nodes around it to minimise
   straight-edge crossings, then edges through other cards, then total edge length.
   Search all ring orders up to seven peripheral nodes, otherwise use bounded pair
   swaps (at most 6000 candidate layouts). Non-planar graphs may still have crossings.
   Pin every initial node with `fx/fy`; no force layout moves the graph afterward.
   Pointer dragging updates the selected node's fixed coordinates using the SVG screen
   transform, so zoom/pan are respected and the node stays where it is released. Other
   nodes remain fixed. A drag does not activate a source dialog. Pointer pan/zoom and
   keyboard-operable zoom/reset controls remain available. Reset view resets zoom only.
3. Nodes are semantic buttons. Focus selects a concept. `node.source` is a discriminated
   union: clicking or pressing Enter/Space on a sourced node opens its details dialog
   (`aria-haspopup="dialog"`). Post nodes are named `"{label}, view article details"`.
   Nodes without a source (`source: null`) open nothing and are named
   `"{label}, no linked source"`.
4. Sourced nodes show a visible `Post` or `Book` text badge; unsourced nodes have none.
   The main idea has a visible `Main idea` text label and its accessible name includes
   `, main idea`. Source type and availability are never conveyed by colour alone.
5. A book section (`kind: 'book'`) is named
   `"{label}, from the book {bookTitle}, {sectionTitle}, page {pageStart}, view book excerpt"`;
   an unknown section or page is omitted, and `, main idea` precedes the action for the
   central node. It shows a visible `View excerpt` hint and opens the book dialog. Book
   dialogs never link to local files.
6. Render the source dialogs outside the SVG through the shared `SourceDialog` frame, using
   the same Tailwind card, primary, border and foreground tokens as the graph.
   - Article dialog: article title, origin, publication date, close control and a real
     `Go to…` anchor with `target="_blank"` and `rel="noopener noreferrer"`. Allow only
     HTTP (S) navigation.
   - Book dialog: the book title as the dialog title, the section, the page where the
     section starts (only when known), and the `Matching excerpt` as a `blockquote`. The
     excerpt is the API's verbatim passage of the retrieved section; never generate or
     reword it on the client.
7. Dialogs trap focus, close on Escape and restore focus to their triggering node.
   Replacing the graph closes stale details. Unknown metadata (`null`) has explicit
   unavailable labels.
8. Use `node.source` from the API for provenance. Never infer the title from the concept
   label, the origin from the URL, or the publication date from the current time.
9. Show directed relationships and their labels in the graph; do not add a separate
   relationship panel. Keep concept buttons keyboard-accessible.
10. After successful generation, every selected retrieved source appears exactly once.
    The API grounds/deduplicates sources, resolves the centre, limits depth, then attaches
    missing sources directly to the centre with a neutral `retrieved source` edge.
    Added nodes show the post title or `{bookTitle} - {sectionTitle}`. These labels identify
    provenance, not additional model-generated claims. Existing concepts remain unchanged.
    With five available selected sources (three book sections, two posts), a seven-node graph
    therefore has five sourced nodes and two unsourced concepts. Seven is an example, not a
    fixed node count: added source nodes can increase the generated graph's size.
    Empty generated graphs become source-only graphs, using the first selected source as the
    centre. Generation failures retain the explanatory empty response.

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
  source: {
    kind: 'post',
    url: 'https://engineering.example.com/caching',
    articleTitle: 'How we cache our API',
    blogName: 'Netflix',
    publishedAt: '2026-01-02T00:00:00.000Z',
  },
};

const bookNode = {
  id: 'feedback',
  label: 'Feedback loops',
  type: 'concept',
  source: {
    kind: 'book',
    bookTitle: 'Engineering Feedback',
    sectionTitle: 'Small loops',
    pageStart: 12,
    excerpt: 'Small feedback loops make engineering changes easier to review.',
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
<div onClick={() => window.open(node.source?.url)}>{node.label}</div>
// Do not display `new Date()` as the article's publication date.
```

### ❌ Bad: Client-side or generated book excerpts

```tsx
// The excerpt must come verbatim from the API's retrieved section, never the LLM summary
// or a client-side guess.
<blockquote>{summary.slice(0, 200)}</blockquote>
```

### ❌ Bad: Source type conveyed only by colour, or a book linking a local file

```tsx
<button className={node.source?.kind === 'book' ? 'bg-amber-300' : 'bg-cyan-300'}>{node.label}</button>
<a href={`file://${bookFilePath}`}>{node.label}</a>
```

## Real world examples

- Lazy boundary: `apps/web/src/features/technical-query/presentation/components/KnowledgeGraph.tsx`
- D3 adapter, layout, controls and modal state:
  `apps/web/src/features/technical-query/presentation/components/KnowledgeGraphCanvas.tsx`
- Semantic node: `apps/web/src/features/technical-query/presentation/components/ConceptNode.tsx`
- Shared dialog frame: `apps/web/src/features/technical-query/presentation/components/SourceDialog.tsx`
- Article modal: `apps/web/src/features/technical-query/presentation/components/ArticleSourceDialog.tsx`
- Book modal: `apps/web/src/features/technical-query/presentation/components/BookSourceDialog.tsx`
- Dependency CSS isolation: `patches/d3-graph-react@1.3.1.patch`
- Real renderer, keyboard and axe checks: `apps/web/e2e/technical-query.spec.ts`

## Related agreements

- [Frontend Architecture](frontend-architecture.md)
- [Frontend State Management](state-management.md)
- [Accessibility](accessibility.md)
- [Performance](performance.md)
- [Shared Contracts](../monorepo/shared-contracts.md)
