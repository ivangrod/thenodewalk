# The Node Walk

SaaS for turning ideas into interactive node-and-edge mind maps.

## Stack

- Monorepo: pnpm workspaces and Turborepo.
- Web: Next.js, React, Tailwind CSS, a shadcn/ui-compatible foundation, Zustand, Vitest, and Playwright.
- API: NestJS REST with OpenAPI, Prisma, PostgreSQL/Supabase, Jest, and Cypress.
- Deployment: Vercel. The API includes a serverless adapter.
- Architecture: Hexagonal, with automated import rules.

## Quick Start

Requires Node 22 and pnpm 10.24.0.

```sh
corepack enable
pnpm install
pnpm infra:up
pnpm dev
```

The web app runs at `http://localhost:3000`, the API at `http://localhost:3001`, its OpenAPI documentation at `http://localhost:3001/docs`, and its health endpoint at `http://localhost:3001/health`.

## Local Infrastructure

Docker Compose starts PostgreSQL 17 (relational data) and ChromaDB (the RAG vector store),
with persistent data in the `postgres-data` and `chroma-data` volumes.

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

## TechGraph RAG (The Node Walk)

The `/ask` experience answers a technical question with a natural-language summary and an
interactive, source-linked knowledge graph. The whole pipeline (ingestion, embeddings,
retrieval, and structured generation) runs 100% locally.

### Prerequisites

- Docker, for PostgreSQL and ChromaDB (started with `pnpm infra:up`).
- [Ollama](https://ollama.com) running locally with the required models pulled:

  ```sh
  ollama pull nomic-embed-text   # embeddings
  ollama pull llama3.1:8b        # structured graph generation
  ```

### Configure

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Defaults work out of the box. Relevant variables: `CHROMA_URL`, `OLLAMA_URL`,
`OLLAMA_EMBEDDING_MODEL`, and `OLLAMA_LLM_MODEL` (API); `NEXT_PUBLIC_API_URL` (web).

### Ingest engineering blogs

The blog subscriptions live in `apps/api/feeds/engineering_blogs.opml`. Index their latest
articles into the vector store:

```sh
pnpm infra:up
pnpm --filter @thenodewalk/api ingest
# or point it at a different OPML file:
pnpm --filter @thenodewalk/api ingest path/to/feeds.opml
```

### Ask a question

```sh
pnpm dev
```

Open `http://localhost:3000/ask` and ask a technical question, or call the API directly:

```sh
curl -X POST http://localhost:3001/technical-queries \
  -H 'Content-Type: application/json' \
  -d '{"query":"How does Netflix scale its API?"}'
```

The response is `{ summary, graph }`; every graph node links back to its original source URL.

## Commands

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

## Architecture

Each functional context uses `domain`, `application`, and `infrastructure` layers. The web app may add `presentation` for UI adapters. Details and rules are in `AGENTS.md`; `pnpm lint:architecture` validates them automatically.
