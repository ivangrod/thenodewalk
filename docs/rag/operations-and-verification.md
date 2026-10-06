# RAG Operations and Verification

## Convention

The TechGraph RAG MVP must be reproducible locally without hosted AI or vector services.
Contributors run the local infrastructure, pull the required Ollama models, ingest an OPML feed
list, and verify the API and web application through the standard test suites.

1. Use Node 22 and pnpm 10.24.0, then run `corepack enable` and `pnpm install`.
2. Run Docker infrastructure with `pnpm infra:up`. This starts PostgreSQL, ChromaDB, pgAdmin, and
   ChromaDB UI. pgAdmin is available at `http://localhost:5050` with the local default login
   `admin@thenodewalk.local` / `thenodewalk`; the `postgres` server is preconfigured and uses
   database credentials `thenodewalk` / `thenodewalk`. ChromaDB UI is at `http://localhost:8090`;
   connect it to `http://localhost:8000` with tenant `default_tenant` and database
   `default_database`. Compose configures ChromaDB CORS for the UI's local origin.
3. Copy the API and web example environment files before running the apps.
4. Install and run Ollama locally, then pull `nomic-embed-text` for embeddings and
   `llama3.1:8b` for structured graph generation.
5. Ingest feeds from `../../apps/api/feeds/engineering_blogs_lite.opml` through the API ingestion CLI.
6. Start the apps with `pnpm dev`, use `/ask`, or call `POST /technical-queries` directly.
7. Keep the Ollama app's global "Context length" setting bounded (8k is enough for the local RAG
   prompts). A large window (128k+) forces `llama3.1:8b` to reserve a multi-GiB KV cache (16 GiB
   on Apple Silicon) and can freeze the host. The API already overrides it per request (`OLLAMA_LLM_CONTEXT_LENGTH`,
   see [Local Pipeline](local-pipeline.md)), but the app-wide
   setting still affects every other local Ollama client.
8. Install `scripts/macos/ollama-env.plist` as a LaunchAgent so `OLLAMA_FLASH_ATTENTION`,
   `OLLAMA_KV_CACHE_TYPE`, and `OLLAMA_KEEP_ALIVE` survive reboots. A bare `launchctl setenv` only
   lasts for the current login session and is silently lost after the next restart or Ollama
   update.
9. Diagnose local incidents from their real source before touching code. A `connection refused`
   against the API usually means `pnpm dev` is not running. An empty `/ask` answer after touching
   local infrastructure can mean `knowledge_chunks` has no ingested data. ChromaDB persists in
   `data_containers/chromadb`, bind-mounted to `/data` and excluded from Git. Recreating containers
   or deleting Docker volumes preserves these files; deleting the host directory or the
   collection itself requires ingestion again.
10. Run the mandatory format, lint, architecture, typecheck, unit, and E2E suites before
    considering a change complete.

A `knowledge_chunks` collection created before the `PrecomputedEmbeddingFunction` guard keeps a
`default` embedding function in its server-side configuration, and the SDK keeps logging the
`DefaultEmbeddingFunction` warning when it opens it. Delete only that collection and ingest again.
Ingestion is idempotent, so no other data migration is needed:

```sh
curl -X DELETE \
  http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/knowledge_chunks
pnpm --filter @thenodewalk/api ingest
```

Integration tests boot `KnowledgeModule` and override the external ports with hand-written
doubles. Playwright E2E tests mock the API at the network boundary so the browser flow is stable
and does not require ChromaDB or Ollama. The E2E flow must run Axe after the graph is rendered.

## Benefits

- Lets a new contributor reproduce the entire local RAG experience consistently.
- Keeps production-like HTTP wiring covered while tests remain deterministic and fast.
- Detects Nest dependency-injection failures that unit tests of isolated classes miss.
- Verifies browser behavior, external source navigation, and accessibility in a real engine.
- Keeps `/ask` responsive on any contributor's machine regardless of the local Ollama GUI
  configuration.
- Makes common local incidents (API not running, wiped vector store) quick to diagnose from
  logs and container state instead of guessing or blaming the query code.
- Avoids flaky E2E tests caused by live feeds, LLM output, or public source websites.

## Examples

### ✅ Good: Reproducible local run

```sh
corepack enable
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm infra:up
ollama pull nomic-embed-text
ollama pull llama3.1:8b

pnpm --filter @thenodewalk/api ingest
pnpm dev
```

Then open `http://localhost:3000/ask`, or query the API directly:

```sh
curl -X POST http://localhost:3001/technical-queries \
  -H 'Content-Type: application/json' \
  -d '{"query":"How does Netflix scale its API?"}'
```

### ✅ Good: Integration and browser E2E at the correct boundaries

```typescript
const moduleRef = await Test.createTestingModule({ imports: [KnowledgeModule] })
  .overrideProvider(EMBEDDING_GENERATOR)
  .useValue(embeddings)
  .overrideProvider(KNOWLEDGE_CHUNK_REPOSITORY)
  .useValue(repository)
  .overrideProvider(STRUCTURED_GRAPH_GENERATOR)
  .useValue(generator)
  .compile();

await page.route('**/technical-queries', (route) =>
  route.fulfill({ status: 201, body: JSON.stringify(technicalQueryResponse) }),
);
```

### ✅ Good: Required verification

```sh
pnpm format:check
pnpm lint
pnpm lint:architecture
pnpm typecheck
pnpm test
pnpm test:e2e
```

### ✅ Good: Install the Ollama LaunchAgent once per machine

```sh
mkdir -p ~/Library/LaunchAgents
cp scripts/macos/ollama-env.plist ~/Library/LaunchAgents/com.thenodewalk.ollama-env.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.thenodewalk.ollama-env.plist
```

Quit and reopen Ollama.app, then confirm the values it picked up:

```sh
grep "server config" ~/.ollama/logs/server.log | tail -1 \
  | grep -oE "OLLAMA_(FLASH_ATTENTION|KV_CACHE_TYPE|KEEP_ALIVE):[^ ]*"
```

### ❌ Bad: Setting Ollama env vars only for the current terminal session

```sh
launchctl setenv OLLAMA_FLASH_ATTENTION 1
# Works today. Gone after the next reboot, login, or Ollama update, with no error
# to explain why the freeze or slow generation came back.
```

### ✅ Good: Confirming the context window before blaming the query code

```sh
grep "KV buffer size" ~/.ollama/logs/server.log | tail -1
# ~16384.00 MiB at a 128k context window, ~1024.00 MiB at 8k.
```

### ❌ Bad: Chasing a "connection refused" in the query code

```sh
curl -X POST http://localhost:3001/technical-queries -d '{"query":"..."}'
# curl: (7) Failed to connect to localhost port 3001: Connection refused
#
# Reading through AnswerTechnicalQueryQuery or the controller wastes time: check first
# whether the API process is even running.
lsof -nP -iTCP:3001 -sTCP:LISTEN   # empty output means the API is not running
```

### ✅ Good: Confirming the vector store before re-running ingestion

```sh
docker inspect thenodewalk-chromadb-1 --format '{{json .Mounts}}'
# Confirm /data is a bind mount sourced from this project's data_containers/chromadb.
curl --fail http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections
# If knowledge_chunks is missing or empty, ingest feeds again.
pnpm --filter @thenodewalk/api ingest
```

### ❌ Bad: Running a query before its local dependencies are ready

```sh
pnpm dev
# Asking now fails or returns no useful data when ChromaDB has not started,
# Ollama models are not pulled, or no feeds have been ingested.
```

### ❌ Bad: Browser E2E that depends on a live LLM and public source website

```typescript
await page.goto('/ask');
await page.getByRole('button', { name: 'Search' }).click();
// Flaky: result depends on local vector data, an LLM response, and external feeds.
await expect(page.getByText('Exact generated sentence')).toBeVisible();
```

## Real world examples

- Local commands and prerequisites: `README.md`
- LaunchAgent template for the Ollama env vars: `scripts/macos/ollama-env.plist`
- Per-request context window and keep-alive: `ollamaGenerationSettingsFromEnv` and
  `DEFAULT_OLLAMA_GENERATION_SETTINGS` in
  `apps/api/src/knowledge/infrastructure/ollama/ollama-structured-graph-generator.ts`
- OPML source list: `../../apps/api/feeds/engineering_blogs_lite.opml`
- Runnable ingestion entrypoint: `apps/api/src/knowledge/infrastructure/cli/ingest.ts`
- HTTP integration test with overridden ports:
  `apps/api/src/knowledge/infrastructure/http/technical-query.controller.integration.spec.ts`
- Playwright happy path and Axe scan: `apps/web/e2e/technical-query.spec.ts`
- Root E2E orchestration: `package.json` and `turbo.json`

## Related agreements

- [TechGraph RAG Local Pipeline](local-pipeline.md)
- [Mock Objects](../testing/mock-objects.md)
- [Object Mothers](../testing/object-mothers.md)
- [Turborepo Configuration](../monorepo/turborepo-configuration.md)
- [Accessibility and UI Components](../frontend/accessibility.md)

Local RAG runs stay repeatable from Docker to browser with 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
