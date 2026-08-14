# The Node Walk - Development Instructions

## Context

The Node Walk is a SaaS for creating graph-based mind maps. A map contains nodes and edges; each node can open a visual card with additional information.

## Required Principles

- All production and test code uses strict TypeScript.
- Preserve Hexagonal Architecture. The domain must not import frameworks, NestJS, Prisma, Next.js, React, or network adapters.
- Use cases live in `application` and depend on ports defined inward. Port implementations belong in `infrastructure`.
- Do not access Prisma from controllers or use cases. Introduce a repository port in the domain or application and a Prisma adapter in infrastructure.
- On the frontend, server state must remain close to its data boundary; use Zustand only for shared, interactive client state.
- Keep components accessible: semantic HTML, controls with accessible names, keyboard support, visible focus, and sufficient contrast.
- Avoid unnecessary client dependencies and review Core Web Vitals when adding graph interfaces or visualization libraries.

## Structure

- `apps/web`: Next.js and the interface.
- `apps/api`: NestJS, Prisma, and the REST API.
- `packages/contracts`: TypeScript contracts shared between applications.
- `packages/typescript-config`: shared TypeScript configuration.

Organize each feature by context, not by global type. Example: `apps/api/src/mind-map/{domain,application,infrastructure}`.

## Required Verification

Run these before considering a task complete:

```sh
pnpm format:check
pnpm lint
pnpm lint:architecture
pnpm typecheck
pnpm test
```

Run E2E tests separately with `pnpm test:e2e`. Playwright also checks accessibility with axe.
