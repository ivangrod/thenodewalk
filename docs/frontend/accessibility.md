# Accessibility and UI Components

## Convention
All frontend components must be accessible. You must use semantic HTML, provide accessible names (e.g., `aria-label`) for icon-only controls, ensure full keyboard support, maintain visible focus rings, and meet contrast requirements. We rely on a `shadcn/ui`-compatible foundation to help, but custom components must strictly follow these rules.

## Benefits
- Ensures the application is usable by everyone, including users relying on screen readers or keyboard navigation.
- Improves SEO and overall HTML structure quality.
- Prevents accessibility bugs from accumulating as the UI grows.

## Examples

### ✅ Good: Semantic HTML with accessible names and visible focus
```tsx
export function CloseMapButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close mind map"
      className="p-2 rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <XIcon className="h-5 w-5 text-gray-700" aria-hidden="true" />
    </button>
  );
}
```

### ❌ Bad: Div as button, no focus ring, no accessible name
```tsx
export function CloseMapButton({ onClick }: { onClick: () => void }) {
  // ❌ Div used for interaction, no keyboard support, screen readers see nothing
  return (
    <div onClick={onClick} className="p-2 cursor-pointer">
      <XIcon className="h-5 w-5 text-gray-300" /> {/* ❌ Poor contrast */}
    </div>
  );
}
```

## Real world examples
- Core UI components: `apps/web/src/components/ui/`
- Mind map controls: `apps/web/src/mind-map/presentation/components/MapControls.tsx`

## Related agreements
- [Performance and Dependencies](performance.md)
