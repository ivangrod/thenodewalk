# Web

The Node Walk Next.js application. The UI uses Tailwind CSS, shadcn/ui-compatible components, and Zustand for focused client state.

## Commands

```sh
pnpm --filter @thenodewalk/web dev
pnpm --filter @thenodewalk/web test
pnpm --filter @thenodewalk/web test:e2e
```

Before running Playwright for the first time, install the browser with `pnpm exec playwright install chromium`.

## Architecture

Each feature lives in `src/features/<feature>/`:

- `domain`: pure rules and types, with no framework dependencies.
- `application`: use cases and ports.
- `infrastructure`: HTTP, persistence, or browser adapters.
- `presentation`: interface components and routes.

`pnpm lint:architecture` prevents inner layers from importing outer layers.
