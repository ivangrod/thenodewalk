---
name: 'Book ingestion and balanced book/post retrieval'
description: 'Ingest local EPUB/PDF books into ChromaDB through a dedicated process and rebalance /ask so graphs prioritise book sources (65%) over post sources (35%) while always including both types.'
created_at: '2026-10-07T17:07:24Z'

created_by:
  tool: 'OpenCode'
  model:
    name: 'Claude Opus'
    version: '5.5'
    reasoning_effort: 'default'
implemented_by:
  tool: 'OpenCode'
  model:
    name: 'OpenAI GPT'
    version: '6.1-sol'
    reasoning_effort: 'unspecified'
last_implementation_at: '2026-10-08T10:19:12Z'
has_completed_all_phases: false
---

# Book ingestion and balanced book/post retrieval

## 🎯 Goal

Add a book ingestion process (EPUB/PDF), separate from the OPML feed pipeline, that indexes local books into ChromaDB. Then
rebalance `/ask` so it uses about 65% book sources and 35% post sources, and every graph includes nodes of both types.

## 👀 Context

- Ingestion pattern to replicate:
  - [`ingest-feeds.command.ts`](../../../apps/api/src/knowledge/application/ingest-feeds.command.ts)
  - [`cli/ingest.ts`](../../../apps/api/src/knowledge/infrastructure/cli/ingest.ts)
  - [`ingestion-progress-reporter.ts`](../../../apps/api/src/knowledge/domain/ingestion-progress-reporter.ts)
  - [`logger-ingestion-progress-reporter.ts`](../../../apps/api/src/knowledge/infrastructure/logging/logger-ingestion-progress-reporter.ts)
  - [`domain/events/`](../../../apps/api/src/knowledge/domain/events/)
- Chunk model and vector store:
  - [`knowledge-chunk.ts`](../../../apps/api/src/knowledge/domain/knowledge-chunk.ts): metadata `{ blogName, articleTitle, articleUrl, publishedAt, chunkIndex }`, id `sha256(articleUrl#chunkIndex)`.
  - [`knowledge-chunk-repository.ts`](../../../apps/api/src/knowledge/domain/knowledge-chunk-repository.ts): `upsert(chunks)`, `search(embedding, limit)`.
  - [`chroma-knowledge-chunk.repository.ts`](../../../apps/api/src/knowledge/infrastructure/chroma/chroma-knowledge-chunk.repository.ts): collection `knowledge_chunks`, `CHROMA_UPSERT_BATCH_SIZE = 500`, cosine score.
  - [`chroma-collection.provider.ts`](../../../apps/api/src/knowledge/infrastructure/chroma/chroma-collection.provider.ts)
  - [`text-chunker.ts`](../../../apps/api/src/knowledge/domain/text-chunker.ts): `chunkText` with 350 words and 40 words of overlap.
  - [`ollama-embedding-generator.ts`](../../../apps/api/src/knowledge/infrastructure/ollama/ollama-embedding-generator.ts): one request per call, no batching.
- `/ask` flow:
  - [`answer-technical-query.query.ts`](../../../apps/api/src/knowledge/application/answer-technical-query.query.ts): `TECHNICAL_QUERY_TOP_K = 5`.
  - [`knowledge-graph.ts`](../../../apps/api/src/knowledge/domain/knowledge-graph.ts): `assignUniqueSources`, `EMPTY_GRAPH`.
  - [`knowledge-graph-focus.ts`](../../../apps/api/src/knowledge/domain/knowledge-graph-focus.ts): `resolveCentralNodeId`, `limitGraphDepth`, `MAX_GRAPH_DEPTH = 3`.
  - [`structured-graph-generator.ts`](../../../apps/api/src/knowledge/domain/structured-graph-generator.ts)
  - [`ollama-structured-graph-generator.ts`](../../../apps/api/src/knowledge/infrastructure/ollama/ollama-structured-graph-generator.ts): prompt `v4`, nodes `{ id, label, type: 'concept', sourceUrl }`.
- Wiring and test doubles:
  - [`knowledge.module.ts`](../../../apps/api/src/knowledge/infrastructure/knowledge.module.ts)
  - [`knowledge.tokens.ts`](../../../apps/api/src/knowledge/application/knowledge.tokens.ts)
  - [`knowledge-test-doubles.ts`](../../../apps/api/src/knowledge/application/testing/knowledge-test-doubles.ts)
  - [`knowledge.mother.ts`](../../../apps/api/src/knowledge/domain/testing/knowledge.mother.ts)
- Incremental ingestion pattern (feeds):
  - [`save-last-publication-date.command.ts`](../../../apps/api/src/knowledge/application/save-last-publication-date.command.ts)
  - [`save-last-publication-date-on-knowledge-feed-ingested.ts`](../../../apps/api/src/knowledge/application/save-last-publication-date-on-knowledge-feed-ingested.ts)
  - [`prisma-feed-last-publication-date.repository.ts`](../../../apps/api/src/knowledge/infrastructure/persistence/prisma-feed-last-publication-date.repository.ts)
  - [`schema.prisma`](../../../apps/api/prisma/schema.prisma)
- Shared contract: [`packages/contracts/src/index.ts`](../../../packages/contracts/src/index.ts) with `KnowledgeGraphNode.sourceUrl: string | null`.
- Web:
  - [`ConceptNode.tsx`](../../../apps/web/src/features/technical-query/presentation/components/ConceptNode.tsx): anchor when `sourceUrl` exists, button otherwise.
  - [`KnowledgeGraphCanvas.tsx`](../../../apps/web/src/features/technical-query/presentation/components/KnowledgeGraphCanvas.tsx)
  - [`KnowledgeGraphCanvas.test.tsx`](../../../apps/web/src/features/technical-query/presentation/components/KnowledgeGraphCanvas.test.tsx)
  - [`TechnicalQueryView.tsx`](../../../apps/web/src/features/technical-query/presentation/components/TechnicalQueryView.tsx)
  - [`technical-query.client.test.ts`](../../../apps/web/src/features/technical-query/infrastructure/technical-query.client.test.ts)
  - [`e2e/technical-query.spec.ts`](../../../apps/web/e2e/technical-query.spec.ts)
- Tooling:
  - [`apps/api/package.json`](../../../apps/api/package.json): CommonJS build, `ts-node` CLI scripts, Jest.
  - [`eslint.architecture.config.mjs`](../../../apps/api/eslint.architecture.config.mjs)
  - [`.gitignore`](../../../.gitignore)
- Documentation to follow and update:
  - `docs/rag/local-pipeline.md`
  - `docs/rag/operations-and-verification.md`
  - `docs/backend/hexagonal-architecture.md`
  - `docs/backend/cqrs-and-domain-events.md`
  - `docs/backend/dependency-injection.md`
  - `docs/database/prisma-conventions.md`
  - `docs/monorepo/shared-contracts.md`
  - `docs/frontend/technical-query-knowledge-graph.md`
  - `docs/frontend/accessibility.md`
  - `docs/testing/mock-objects.md`
  - `docs/testing/object-mothers.md`
- Reference PDF for the cleanup heuristics: `Agile Technical Practices Distilled.pdf`. Observed artefacts: running headers
  such as `12 | Classic TDD I – Test-Driven Development`, dot-leader table of contents, index, blank pages, copyright
  page, compound words split at line ends (`Test-\nDriven`) and ligatures. The first-level folder (`AGILE`) is the book
  category.
- Out of scope: the unmerged `feat/d3-graph-source-modal` branch (D3 renderer and source modal), OCR for scanned PDFs, and
  opening the book file from the UI.

### Agreed decisions

- Phases: very granular (7 phases), all committed on the `feature/book-ingestion` branch.
- Storage: a single `knowledge_chunks` collection with `sourceType` and `sourceId` metadata, plus an idempotent migration
  of the existing post chunks.
- Book source granularity: book plus section (chapter). `sourceId = bookId#sectionIndex`.
- Central node: the best match overall, book or post (current behaviour).
- Source coverage: every retrieved source is deterministically linked to a node. Missing sources are attached to the
  central node.
- Incremental ingestion: PostgreSQL table `ingested_books`, updated from the `BookIngested` event.
- Books directory: `apps/api/books/` (excluded from git), overridable with `BOOKS_DIR`.
- Book node UI: a button with a visible `Book` badge and an accessible name with the book title and section.
- When a corpus has fewer matches than its quota, the free slots are filled with the other source type.
- No minimum relevance threshold for now.

## 🪜 Phases

### Phase 1: Source-typed chunks and node sources (posts only)

Tag every chunk with `sourceType` and `sourceId`, migrate the existing post chunks in ChromaDB, and replace `sourceUrl`
with a discriminated `source` in the shared contract. Behaviour does not change, and post nodes show a visible `Post`
badge.

- [x] Domain: `KnowledgeChunkMetadata = PostChunkMetadata` with
      `{ sourceType: 'post'; sourceId: string; blogName; articleTitle; articleUrl; publishedAt; chunkIndex }`, where
      `sourceId` is the article URL. Add `KnowledgeSourceType = 'post' | 'book'`. Post chunk ids stay
      `sha256(articleUrl#chunkIndex)`, so nothing needs re-embedding.
- [x] Domain graph: rename `node.sourceUrl` to `node.sourceId: string | null`. New signatures:
  - `assignUniqueSources(graph, retrievedSourceIds: ReadonlySet<string>)`
  - `resolveCentralNodeId(graph, mainSourceId: string)`
- [x] `IngestFeedsCommand` writes `sourceType: 'post'` and `sourceId: articleUrl`.
- [x] Chroma adapter persists the new keys and maps legacy chunks without `sourceType` as posts.
- [x] Infrastructure migration `backfillPostSourceType(collection)` and CLI script
      `pnpm --filter @thenodewalk/api chroma:migrate`. It pages through the collection, writes the full merged metadata
      for chunks without `sourceType`, and is idempotent.
- [x] Shared contract:
  - `KnowledgeNodeSource = { kind: 'post'; url: string }`.
  - `KnowledgeGraphNode.source: KnowledgeNodeSource | null` replaces `sourceUrl`.
- [x] `AnswerTechnicalQueryQuery` maps each node `sourceId` to its contract `source` using the retrieved matches.
- [x] Web `ConceptNode`: post nodes stay links and get a visible text badge `Post`.
- [x] Test suites:
  - `answer-technical-query.query.spec.ts`:
    - maps a post source to `{ kind: 'post', url }`.
    - returns `source: null` for unsourced nodes.
    - existing cases rewritten to use `sourceId`.
  - `knowledge-graph.spec.ts`: existing cases rewritten to use `sourceId`.
  - `knowledge-graph-focus.spec.ts`: resolves the central node by `sourceId`.
  - `ingest-feeds.command.spec.ts`: stores `sourceType: 'post'` and `sourceId` equal to the article URL.
  - `chroma-knowledge-chunk.repository.spec.ts`:
    - persists `sourceType` and `sourceId`.
    - maps a legacy chunk without `sourceType` as a post.
  - `backfill-post-source-type.spec.ts` (new):
    - tags legacy post chunks with `sourceType` and `sourceId`.
    - preserves the existing metadata.
    - skips chunks that are already tagged.
    - is idempotent.
  - `KnowledgeGraphCanvas.test.tsx`:
    - renders a `Post` badge on post-sourced nodes.
    - renders unsourced nodes without a badge.
  - `technical-query.client.test.ts` and `e2e/technical-query.spec.ts`: fixtures moved from `sourceUrl` to `source`.
- [x] UI copy: `Post`.
- [x] Update `docs/rag/local-pipeline.md` (metadata schema and migration) and
      `docs/frontend/technical-query-knowledge-graph.md`.
- [x] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [x] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

Verification: all five required commands passed, as did `pnpm test:e2e` (119 API tests,
12 web tests, 4 Playwright tests including axe checks, and 1 Cypress test). The migration
was subsequently run against the local knowledge collection: 49,644 post chunks migrated
(metadata only).

### Phase 2: Book parsing dependencies (spike)

Add the EPUB and PDF parsing libraries and prove that they load under `nest build` (CommonJS), `ts-node` and Jest.

- [x] EPUB: add a zip library (candidate `jszip`) and reuse the existing `jsdom` dependency for XHTML.
- [x] PDF: evaluate `unpdf`, `pdfjs-dist` and `pdf-parse` for per-page text extraction, outline support and ESM/CJS
      compatibility (`require(esm)` on Node 22.17). Pin the chosen version exactly.
- [x] Add generated, license-free fixtures `apps/api/test/fixtures/books/sample.epub` and
      `apps/api/test/fixtures/books/sample.pdf`.
- [x] Test suites:
  - `book-parsing-libraries.spec.ts` (new, later replaced by the adapter specs):
    - opens the EPUB fixture archive.
    - reads the PDF fixture page text.
- [x] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [x] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

Decision: pin `jszip@3.10.2` and `unpdf@1.8.1`. The existing `jsdom` parses XHTML.
`unpdf` ships bundled serverless PDF.js and exposes per-page text, metadata, outlines and
`getPageIndex` for chapter destinations. `pdfjs-dist@6.4.299` was assessed via package metadata
(ESM entrypoint); `pdf-parse@2.4.5` was installed and trialled, then removed: it also needs
Jest VM-module support, adds native canvas and lacks a public document proxy to resolve
outline destinations. Both PDF candidates failed in standard Jest due to dynamic imports.
API test and coverage scripts now use `--experimental-vm-modules`; production remains
CommonJS and needs no extra flags. This is the compatibility adjustment discovered by the spike.

Verification: all five required commands passed (121 API tests, 12 web tests).
`pnpm --filter @thenodewalk/api books:verify` passed under ts-node, `nest build` passed,
and the compiled CommonJS CLI passed under Node 22.17.1. The synthetic EPUB and two-page PDF
include original CC0 content, with a reproducible TypeScript generator and a fixture README
documenting the decision and commands. The PDF test checks text by page, metadata and
outline-to-page resolution.

### Phase 3: EPUB ingestion end to end and book nodes in `/ask`

A runnable `ingest:books` CLI indexes EPUB books, and `/ask` can return book nodes that carry a `Book` badge.

- [x] Application service `IngestBooksCommand`:
  - `execute(booksDir: string, options?: { full?: boolean }): Promise<BookIngestionResult>`
  - `BookIngestionResult { processedBooks: number; indexedChunks: number; skippedBooks: number; issues: BookIngestionIssue[] }`
  - `BookIngestionIssue { filePath: string; type: 'unreadable' | 'empty' | 'duplicate' | 'unsupported'; reason: string }`
- [x] Domain ports:
  - `BookLibraryReader.list(booksDir: string): Promise<{ books: BookFile[]; unsupported: string[] }>`, with
    `BookFile { filePath: string; format: 'epub' | 'pdf'; category: string | null }`.
  - `BookContentReader.read(file: BookFile): Promise<BookContent>`, with
    `BookContent { contentHash: string; title: string; authors: string[]; sections: BookSection[] }` and
    `BookSection { index: number; title: string; text: string; pageStart: number | null; pageEnd: number | null }`.
- [x] Domain chunk model:
  - `BookChunkMetadata { sourceType: 'book'; sourceId; bookId; bookTitle; authors; format; category?; sectionTitle; sectionIndex; pageStart?; pageEnd?; chunkIndex; filePath }`, where `bookId` is the content hash and `sourceId` is `bookId#sectionIndex`.
  - Null values are omitted because ChromaDB metadata does not accept them.
  - `KnowledgeChunkMetadata = PostChunkMetadata | BookChunkMetadata`.
  - Book chunk id: `sha256(bookId#sectionIndex#chunkIndex)`.
- [x] Domain events:
  - `BookIngested(bookId, title, filePath, chunkCount, occurredAt)`
  - `BookIngestionFailed(filePath, reason, occurredAt)`
  - `BooksIngestionCompleted(processedBooks, indexedChunks, occurredAt)`
- [x] Progress reporter port `BookIngestionProgressReporter` with `bookStarted(progress)`,
      `bookCompleted(progress, { sections, chunks })` and `bookFailed(progress, reason)`, where
      `progress = { position; total; filePath }`. Add a logger adapter.
- [x] Infrastructure adapters:
  - `FsBookLibraryReader`: recursive scan; the first-level folder becomes the category.
  - `EpubBookContentReader`: `META-INF/container.xml`, then OPF (title, authors, spine), then nav or NCX for section
    titles, then text extraction with `jsdom`.
  - `CompositeBookContentReader`: dispatches by format. PDF files are reported as `unsupported` until Phase 4.
- [x] Embedding batching in `OllamaEmbeddingGenerator` (`OLLAMA_EMBED_BATCH_SIZE = 32`). Chunks are upserted per book.
- [x] CLI `apps/api/src/knowledge/infrastructure/cli/ingest-books.ts` and script `"ingest:books"`:
      `pnpm --filter @thenodewalk/api ingest:books [--full] [path/to/books]`. The default directory is `apps/api/books/`
      unless `BOOKS_DIR` is set. Add `apps/api/books/` to `.gitignore`.
- [x] Structured graph prompt `v5`: retrieved sources become opaque labels `S1..Sn`. Books are described by title and
      section and posts by title and blog. The LLM returns a source label per node, and the generator maps it back to
      the `sourceId`. Unknown labels become `null`.
- [x] Shared contract: add
      `{ kind: 'book'; bookTitle: string; sectionTitle: string | null; pageStart: number | null }` to
      `KnowledgeNodeSource`.
- [x] Web `ConceptNode`: a book node renders as a `button` with a visible `Book` badge. Its accessible name is
      `{label}, from the book {bookTitle}, {sectionTitle}`.
- [x] Test suites:
  - `ingest-books.command.spec.ts` (new):
    - indexes every EPUB section as book chunks.
    - stores the first-level folder as category.
    - reports a book without extractable text as `empty`.
    - ingests duplicated content once and reports the copy as `duplicate`.
    - isolates a failing book, emits `BookIngestionFailed` and continues.
    - reports unsupported files.
    - emits `BookIngested` per book and `BooksIngestionCompleted` at the end.
    - reports progress per book.
  - `knowledge-chunk.spec.ts` (new):
    - derives book chunk ids from `bookId`, `sectionIndex` and `chunkIndex`.
    - keeps post chunk ids derived from `articleUrl`.
  - `fs-book-library.reader.spec.ts` (new):
    - lists EPUB and PDF files recursively.
    - uses the first-level folder as category.
    - returns unsupported extensions.
  - `epub-book-content.reader.spec.ts` (new):
    - reads title and authors from the OPF.
    - returns sections in spine order with their navigation titles.
    - skips sections without text.
    - fails with a readable reason for a corrupt archive.
  - `ollama-embedding-generator.spec.ts`: splits large inputs into batches preserving order.
  - `chroma-knowledge-chunk.repository.spec.ts`: round-trips book metadata omitting null values.
  - `ollama-structured-graph-generator.spec.ts`:
    - labels retrieved sources `S1..Sn` in the prompt.
    - maps source labels back to source ids.
    - drops unknown source labels.
  - `answer-technical-query.query.spec.ts`: maps a book match to a book source.
  - `KnowledgeGraphCanvas.test.tsx`: renders a book node as a button with a `Book` badge and its accessible name.
  - `e2e/technical-query.spec.ts`: shows book and post nodes with their badges (axe included).
- [x] UI copy: `Book`, `from the book {bookTitle}, {sectionTitle}`.
- [x] Update `docs/rag/local-pipeline.md` and `docs/rag/operations-and-verification.md` with the book ingestion
      section.
- [x] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [x] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

Verification: all five required commands passed (137 API tests and 13 web tests), as did
`pnpm test:e2e` (4 Playwright tests including mixed book/post badges and axe, 1 Cypress test).
The integration test wires real filesystem and EPUB adapters through Nest, indexes the
synthetic EPUB with stubbed embeddings, then resolves a book source through the query.
EPUB 2 NCX and EPUB 3 navigation, empty sections, duplicates, failed persistence retries,
book metadata round-tripping and ordered embedding batches are covered. Chroma authors
are JSON-encoded at the adapter boundary; optional metadata fields are omitted.

### Phase 4: PDF ingestion with text cleanup

`ingest:books` also indexes PDF books, with sections, page ranges and cleaned text.

- [x] Infrastructure adapter `PdfBookContentReader`:
  - Builds sections from the PDF outline with `pageStart` and `pageEnd`.
  - Falls back to fixed page-range sections when there is no outline.
  - Reads title and authors from the PDF info dictionary, falling back to the file name.
- [x] Domain `cleanBookText(pages: string[]): string[]`:
  - Removes running headers and footers repeated across pages, and standalone page numbers.
  - Drops dot-leader table of contents lines and blank pages.
  - Joins words hyphenated across lines (`develop-\nment` becomes `development`) and keeps compound-word hyphens when the
    next word starts with an uppercase letter (`Test-\nDriven` becomes `Test-Driven`).
  - Normalizes ligatures with NFKC.
- [x] Skip front and back matter sections by title (Copyright, Contents, Index).
- [x] `CompositeBookContentReader` dispatches PDF files to the new adapter.
- [x] A PDF without extractable text is reported as `empty` with the reason
      `No extractable text (scanned PDF? OCR not supported)`.
- [x] Test suites:
  - `book-text-cleaner.spec.ts` (new):
    - removes repeated running headers.
    - removes standalone page numbers.
    - drops dot-leader table of contents lines.
    - joins words hyphenated across lines.
    - keeps compound-word hyphens split at a line end.
    - normalizes ligatures.
    - drops blank pages.
  - `pdf-book-content.reader.spec.ts` (new):
    - builds sections from the outline with page ranges.
    - falls back to page-range sections without an outline.
    - reads the title from metadata or the file name.
    - returns no sections for a PDF without text.
  - `ingest-books.command.spec.ts`: reports a scanned PDF as `empty`.
- [x] Update `docs/rag/local-pipeline.md` with the PDF cleanup rules and limitations.
- [x] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [x] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

Verification: all five required checks passed (149 API tests, 13 web tests).
Reader tests use actual PDFs: the existing fixture plus original generated documents for
named destinations, no outline, front/back matter, text cleanup, blank pages and corrupt input.
The Nest integration now ingests both EPUB and PDF and resolves a PDF chapter with page 1.
Blank pages retain their positions for physical page references. Without valid bookmarks,
sections use ten-page windows. Boundary-line detection requires at least three occurrences
and 60% of pages. Chunk page ranges remain section-level, documented in the pipeline.

### Phase 5: Balanced retrieval 65/35

`/ask` retrieves books and posts separately and combines them with a 65/35 quota that always includes both types.

- [x] Domain port: `KnowledgeChunkRepository.search(embedding: number[], limit: number, filter?: { sourceType: KnowledgeSourceType }): Promise<KnowledgeSearchMatch[]>`.
      The Chroma adapter maps the filter to `where: { sourceType }`.
- [x] Domain `selectBalancedMatches(bookMatches, postMatches, { total, bookShare }): KnowledgeSearchMatch[]`:
  - Keeps the best chunk per `sourceId`.
  - `bookSlots = clamp(round(total * bookShare), 1, total - 1)`, which gives 3 books and 2 posts for `total = 5`.
  - Fills the free slots with the other source type when a corpus falls short.
  - Orders the result by score.
- [x] `AnswerTechnicalQueryQuery` embeds the question once, runs both filtered searches with `Promise.all` and
      overfetch (`TECHNICAL_QUERY_OVERFETCH = 20`), and uses `BOOK_SOURCE_SHARE = 0.65`. The central node keeps using
      the best match overall.
- [x] Test suites:
  - `balanced-matches.spec.ts` (new):
    - selects 3 books and 2 posts out of 5.
    - includes at least one source of each type when both exist.
    - fills missing book slots with posts.
    - fills missing post slots with books.
    - keeps one chunk per source.
    - orders the result by score.
    - returns no matches when both corpora are empty.
  - `answer-technical-query.query.spec.ts`:
    - searches books and posts in parallel with a single embedding.
    - builds the graph from the balanced matches.
  - `chroma-knowledge-chunk.repository.spec.ts`: filters the search by `sourceType`.
- [x] Update `docs/rag/local-pipeline.md` with the balanced retrieval rules.
- [x] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [x] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

Verification: all five required checks passed (164 API tests, 13 web tests).
The selector tests cover 3/2 quotas, best-chunk deduplication, same-book distinct sections,
corpus shortfalls/absence, score ordering, empty results and zero/one-slot configuration.
A deferred-promise query test proves that both searches start before either resolves and
that the generator receives the balanced context. Adapter tests verify both source filters
and omission of `where` for unfiltered searches. Finite overfetch can still return fewer
distinct sources than the target; this limitation and the prerequisite metadata backfill
are documented. Source coverage in the generated graph remains Phase 6.

### Phase 6: Guaranteed source coverage in the graph

Every retrieved source appears exactly once in the graph, so a 7-node graph shows 3 book nodes, 2 post nodes and the
remaining nodes without a source.

- [ ] Domain `attachMissingSources(graph, sources: RetrievedSource[]): KnowledgeGraph`:
  - Adds one node per retrieved source not linked by any generated node. Book labels are
    `{bookTitle} - {sectionTitle}` and post labels are the article title.
  - Connects every added node to the central node, so the graph stays within `MAX_GRAPH_DEPTH`.
- [ ] Pipeline order in `AnswerTechnicalQueryQuery`: assign unique sources, resolve the central node, limit depth, then
      attach missing sources.
- [ ] Test suites:
  - `attach-missing-sources.spec.ts` (new):
    - adds a node per unlinked source.
    - connects added nodes to the central node.
    - labels book nodes with title and section and post nodes with the article title.
    - does nothing when every source is linked.
    - keeps the graph within `MAX_GRAPH_DEPTH`.
  - `answer-technical-query.query.spec.ts`: links every retrieved source exactly once.
- [ ] Update `docs/frontend/technical-query-knowledge-graph.md` with the coverage rule.
- [ ] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [ ] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

### Phase 7: Incremental book ingestion

`ingest:books` skips books already ingested unless `--full` is passed.

- [ ] Database schema: table `ingested_books` (`book_id` primary key, `file_path`, `title`, `chunk_count`,
      `ingested_at`) with its Prisma model and migration.
- [ ] Domain port `IngestedBookRepository { findAllIds(): Promise<Set<string>>; save(book: IngestedBook): Promise<void> }`
      with a Prisma adapter.
- [ ] Application service `SaveIngestedBookCommand.execute(book: IngestedBookPrimitives): Promise<void>`, triggered by
      the `SaveIngestedBookOnBookIngested` handler.
- [ ] Domain event `IngestedBookSaved(bookId, occurredAt)`.
- [ ] `IngestBooksCommand` skips known content hashes (counted as `skippedBooks`) unless `full` is set.
- [ ] Test suites:
  - `ingest-books.command.spec.ts`:
    - skips books already ingested.
    - re-ingests every book with `full`.
  - `save-ingested-book.command.spec.ts` (new): saves the book and emits `IngestedBookSaved`.
- [ ] Update `docs/rag/operations-and-verification.md` with the incremental behaviour and `--full`.
- [ ] Verify the changes in terms of typechecking, linting and tests using the project's verification command
      (`pnpm format:check`, `pnpm lint`, `pnpm lint:architecture`, `pnpm typecheck`, `pnpm test`). Fix issues if any.
- [ ] STOP. Present the changes to the user for review and suggest commit messages. Do NOT proceed to the next phase
      until the user explicitly asks.

## ⏭️ Next step

Review Phase 5, then implement Phase 6 (guaranteed source coverage in the graph) when explicitly requested.

With badges 🏷️, books 📚 and clean chapters 🧹 balanced ⚖️ for the graph 🕸️, 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot) walks toward complete source coverage.
