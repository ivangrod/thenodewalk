# RAG Operations and Verification

## Convention

The TechGraph RAG MVP must be reproducible locally without hosted AI or vector services.
Contributors run the local infrastructure, pull the required Ollama models, ingest an OPML feed
list, and verify the API and web application through the standard test suites.

1. Use Node 22 and pnpm 10.24.0, then run `corepack enable` and `pnpm install`.
2. Run Docker infrastructure with `pnpm infra:up`. This starts PostgreSQL and ChromaDB.
3. Copy the API and web example environment files before running the apps.
4. Install and run Ollama locally, then pull `nomic-embed-text` for embeddings and
   `llama3.1:8b` for structured graph generation.
5. Ingest feeds from `apps/api/feeds/engineering_blogs.opml` through the API ingestion CLI.
6. Start the apps with `pnpm dev`, use `/ask`, or call `POST /technical-queries` directly.
7. Run the mandatory format, lint, architecture, typecheck, unit, and E2E suites before
   considering a change complete.

Integration tests boot `KnowledgeModule` and override the external ports with hand-written
doubles. Playwright E2E tests mock the API at the network boundary so the browser flow is stable
and does not require ChromaDB or Ollama. The E2E flow must run Axe after the graph is rendered.

## Benefits

- Lets a new contributor reproduce the entire local RAG experience consistently.
- Keeps production-like HTTP wiring covered while tests remain deterministic and fast.
- Detects Nest dependency-injection failures that unit tests of isolated classes miss.
- Verifies browser behavior, external source navigation, and accessibility in a real engine.
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
- OPML source list: `apps/api/feeds/engineering_blogs.opml`
- Runnable ingestion entrypoint: `apps/api/src/knowledge/infrastructure/cli/ingest.ts`
- HTTP integration test with overridden ports: `apps/api/src/knowledge/infrastructure/http/technical-query.controller.integration.spec.ts`
- Playwright happy path and Axe scan: `apps/web/e2e/technical-query.spec.ts`
- Root E2E orchestration: `package.json` and `turbo.json`

## Related agreements

- [TechGraph RAG Local Pipeline](local-pipeline.md)
- [Mock Objects](../testing/mock-objects.md)
- [Object Mothers](../testing/object-mothers.md)
- [Turborepo Configuration](../monorepo/turborepo-configuration.md)
- [Accessibility and UI Components](../frontend/accessibility.md)

Local RAG runs stay repeatable from Docker to browser with 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
