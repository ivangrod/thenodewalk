# The Node Walk

SaaS for turning ideas into interactive node-and-edge mind maps.

## Stack

- Monorepo: pnpm workspaces and Turborepo.
- Web: Next.js, React, Tailwind CSS, a shadcn/ui-compatible foundation, Zustand, Vitest, and Playwright.
- API: NestJS REST with OpenAPI, Prisma, PostgreSQL/Supabase, Jest, and Cypress.
- Deployment: Vercel. The API includes a serverless adapter.
- Architecture: Hexagonal, with automated import rules.

## Inicio rapido

Requires Node 22 and pnpm 10.24.0.

```sh
corepack enable
pnpm install
pnpm infra:up
pnpm dev
```

The web app runs at `http://localhost:3000`, the API at `http://localhost:3001`, its OpenAPI documentation at `http://localhost:3001/docs`, and its health endpoint at `http://localhost:3001/health`.

## Local Infrastructure

Docker Compose starts PostgreSQL 17 with persistent data in the `postgres-data` volume.

```sh
pnpm infra:up
cp apps/api/.env.example apps/api/.env
pnpm --filter @thenodewalk/api prisma:migrate
```

The database is available at `localhost:5432`. Values in `compose.yaml` and `.env.example` are only for local development; they are not used for Supabase or production.

```sh
pnpm infra:ps
pnpm infra:logs
pnpm infra:down
```

`infra:down` preserves the data volume. Run `docker compose down --volumes` only when you want to remove the local database.

## Comandos

```sh
pnpm build
pnpm lint
pnpm lint:architecture
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format:check
pnpm infra:up
pnpm infra:down
```

To install Playwright browsers for the first time, run `pnpm exec playwright install chromium`.

## Vercel Deployment

Configure two Vercel projects from the same repository:

- Web: root directory `apps/web`.
- API: root directory `apps/api`; the serverless handler is in `api/index.ts` and its routes are rewritten through `vercel.json`.

Connection and environment variable configuration is deliberately outside this scaffolding.

## Arquitectura

Each functional context uses `domain`, `application`, and `infrastructure` layers. The web app may add `presentation` for UI adapters. Details and rules are in `AGENTS.md`; `pnpm lint:architecture` validates them automatically.
