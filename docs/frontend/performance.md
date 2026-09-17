# Performance and Dependencies

## Convention
Avoid unnecessary client dependencies. Before adding new libraries (especially graph interfaces or complex visualization tools), review Core Web Vitals impacts (LCP, CLS, INP). Prefer lightweight, modular packages or native browser APIs over heavy monolithic libraries. Heavy client-side components must be lazy-loaded using Next.js `next/dynamic`.

## Benefits
- Keeps bundle sizes small, ensuring fast load times and better Core Web Vitals.
- Reduces the risk of vendor lock-in with massive visualization libraries.
- Improves application responsiveness (INP) by avoiding main-thread blocking operations.

## Examples

### ✅ Good: Lazy loading a heavy graph component
```tsx
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// The heavy canvas/graph library is only loaded on the client when needed
const MindMapCanvas = dynamic(
  () => import('../presentation/components/MindMapCanvas'),
  { ssr: false, loading: () => <Skeleton className="w-full h-[500px]" /> }
);

export function MapViewer() {
  return <MindMapCanvas />;
}
```

### ❌ Bad: Static import of heavy dependencies
```tsx
// ❌ Static import forces the graph library into the initial bundle
import { MindMapCanvas } from '../presentation/components/MindMapCanvas';

export function MapViewer() {
  return <MindMapCanvas />;
}
```

## Real world examples
- Graph visualization loading: `apps/web/src/mind-map/presentation/pages/MapPage.tsx`
- Lazy loaded modules: `apps/web/src/shared/presentation/utils/dynamic-imports.ts`

## Related agreements
- [Accessibility and UI Components](accessibility.md)
