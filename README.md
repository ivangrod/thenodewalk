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

Docker Compose starts PostgreSQL 17 (relational data), ChromaDB (the RAG vector store),
pgAdmin, and ChromaDB UI. Database data persists in the `postgres-data` Docker volume;
pgAdmin configuration persists in `pgadmin-data`. ChromaDB stores its collections and
embeddings in `./data_containers/chromadb`, bind-mounted to `/data` inside the container.
The `data_containers` directory is excluded from Git and created automatically by Compose.

```sh
pnpm infra:up
cp apps/api/.env.example apps/api/.env
pnpm --filter @thenodewalk/api prisma:migrate
```

The database is available at `localhost:5432`. Open pgAdmin at `http://localhost:5050`
(`admin@thenodewalk.local` / `thenodewalk`) to administer the preconfigured `postgres` server;
its database credentials are `thenodewalk` / `thenodewalk`. Open ChromaDB UI at
`http://localhost:8090` and connect it to `http://localhost:8000` (tenant
`default_tenant`, database `default_database`). The ChromaDB UI image is built from the upstream
[BlackyDrum/chromadb-ui](https://github.com/BlackyDrum/chromadb-ui) repository when Compose starts.

Override the local UI ports or pgAdmin login with `PGADMIN_PORT`, `PGADMIN_DEFAULT_EMAIL`,
`PGADMIN_DEFAULT_PASSWORD`, `CHROMA_UI_PORT`, and `CHROMA_PORT`. Values in `compose.yaml` are only
for local development; they are not used for Supabase or production.

```sh
pnpm infra:ps
pnpm infra:logs
pnpm infra:down
```

`infra:down` preserves all stored data. `docker compose down --volumes` removes the PostgreSQL
and pgAdmin Docker volumes, but preserves ChromaDB collections in `data_containers/chromadb`.
Those collections are available again after `pnpm infra:up`; deleting the host directory or
deleting a collection through the ChromaDB API still removes its data.

If you already have data in the previous `thenodewalk_chroma-data` volume, migrate it before
recreating ChromaDB with the new mount. With the existing container still present and the
destination directory empty:

```sh
mkdir -p data_containers/chromadb
docker compose stop chromadb
docker cp thenodewalk-chromadb-1:/data/. ./data_containers/chromadb/
docker compose up --detach chromadb
```

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
`OLLAMA_EMBEDDING_MODEL`, `OLLAMA_LLM_MODEL`, `OLLAMA_LLM_CONTEXT_LENGTH` (default `8192`), and
`OLLAMA_LLM_KEEP_ALIVE` (default `30m`) (API); `NEXT_PUBLIC_API_URL` (web).

### Ingest engineering blogs

The blog subscriptions live in `apps/api/feeds/engineering_blogs.opml`. Index their latest
articles into the vector store:

```sh
pnpm infra:up
pnpm --filter @thenodewalk/api prisma:generate
pnpm --filter @thenodewalk/api prisma:deploy
pnpm --filter @thenodewalk/api ingest
# or point it at a different OPML file:
pnpm --filter @thenodewalk/api ingest path/to/feeds.opml
# Recover after deleting ChromaDB data, or deliberately rebuild the vectors:
pnpm --filter @thenodewalk/api ingest --full path/to/feeds.opml
```

Incremental ingestion loads the latest indexed publication date per `blogName` from
PostgreSQL once, then skips dated posts at or before that date before fetching article
text or generating embeddings. Posts are sorted newest first, and chunks are saved feed
by feed. Each successful feed publishes one in-memory event whose subscriber saves the
latest indexed date in `feed_last_publication_dates`. Subscriber failures are logged and
retried by the next idempotent ingestion; PostgreSQL must be reachable for the initial read.

Posts without a valid publication date are always ingested and never advance the cursor.
Distinct feeds sharing a blog name bypass the cursor and report `ambiguous-origin` issues.
Renaming a blog triggers a full ingestion for that new name. The comparison is strictly
newer: backdated posts and posts later added with the exact cursor timestamp require `--full`.
The first run after upgrading reingests existing vectors idempotently to populate dates.

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

### Local Ollama performance

The API always sends its own bounded context window (`OLLAMA_LLM_CONTEXT_LENGTH`, default `8192`)
and `keep_alive` (`OLLAMA_LLM_KEEP_ALIVE`, default `30m`) with every generation request, so `/ask`
stays fast regardless of your machine's Ollama configuration. Still, on macOS:

- Keep the Ollama app's "Context length" setting bounded (8k is enough). A much larger window
  (128k+) makes `llama3.1:8b` reserve a multi-GiB KV cache and can freeze the host.
- Install `scripts/macos/ollama-env.plist` as a LaunchAgent so `OLLAMA_FLASH_ATTENTION`,
  `OLLAMA_KV_CACHE_TYPE`, and `OLLAMA_KEEP_ALIVE` are set on every login, not just the current
  terminal session:

  ```sh
  mkdir -p ~/Library/LaunchAgents
  cp scripts/macos/ollama-env.plist ~/Library/LaunchAgents/com.thenodewalk.ollama-env.plist
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.thenodewalk.ollama-env.plist
  ```

  Quit and reopen Ollama.app afterward for it to pick up the new values.

See [RAG Operations and Verification](docs/rag/operations-and-verification.md) for the full
diagnosis and how to verify it.

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
