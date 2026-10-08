# Book ingestion: conversation record

This is a reconstructed record of the available conversation, not a verbatim IDE export.
Repeated phase instructions and tool output are condensed. Earlier requirements come from
the retained conversation summary.

## Requirements and planning

The user requested a separate EPUB/PDF book ingestion process into ChromaDB, with books in
a gitignored project directory. `/ask` should favour books at approximately 65/35 over posts,
with both source types represented. The example was seven graph nodes: three book sources,
two posts, and two unsourced concepts. The user initially requested analysis and a plan only.

The assistant explored feed ingestion, retrieval, graph generation, contracts, UI, architecture,
and the reference PDF, then presented a seven-phase plan.

The user selected:

- Seven granular phases.
- One Chroma collection with `sourceType` metadata.
- Book plus chapter as source granularity.
- Best global match as the central-source fallback.
- Deterministic attachment of missing graph sources.
- PostgreSQL `ingested_books` for incremental tracking.
- `apps/api/books/` with `BOOKS_DIR` override.
- Book nodes as buttons with a visible `Book` badge.

Other recorded defaults: fill corpus shortfalls with the other source type and use no
minimum relevance threshold.

**User:** “si, lo apruebo”

The assistant created `feature/book-ingestion` and saved
`2026_10_07-book_ingestion-plan.md` alongside this record.

## Phase implementation rules

For each phase, the user explicitly requested implementation of that phase only. The repeated
instructions required stopping for review, updating plan checkboxes/frontmatter, suggesting
three commit messages, and never committing or pushing without approval.

## Phase 1: typed post sources

**User:** “Implementa la Fase 1”

Implemented post chunk `sourceType`/`sourceId`, domain graph `sourceId`, public
`source: { kind: 'post', url } | null`, a visible `Post` badge, and an idempotent Chroma
metadata migration CLI. Post IDs and embeddings were preserved.

Verification: five mandatory checks, 119 API tests, 12 web tests, four Playwright tests with
axe and one Cypress test passed.

**User:** “commit con mensaje 1”

Commit: `659a28a`, `feat!: add typed post sources and graph badges`.

**User:** “arranca la chroma migration”

Executed `pnpm --filter @thenodewalk/api chroma:migrate` successfully. Updated metadata for
49,644 post chunks, preserving IDs, documents and vectors.

## Phase 2: parsing dependency spike

**User:** “Implementa la Fase 2”

Selected exact versions `jszip@3.10.2` and `unpdf@1.8.1`, reusing jsdom for XHTML. Assessed
pdfjs-dist package metadata and trialled pdf-parse, then removed it. Dynamic PDF.js imports
required `--experimental-vm-modules` in Jest; API tests and coverage scripts were updated.
Production stayed CommonJS.

Added original synthetic EPUB/PDF fixtures, a reproducible generator, dependency rationale,
parsing tests, and `books:verify`. Verified page text, metadata and outline destinations in
Jest, ts-node and compiled CommonJS execution. Five mandatory checks and 133 tests passed.

**User:** “commit con mensaje 1”

Commit: `4c02a33`, `build: add verified EPUB and PDF parsing dependencies`.
PDF/EPUB files were marked binary in `.gitattributes`.

## Phase 3: EPUB ingestion and book nodes

**User:** “Implementa la Fase 3”

Implemented `ingest:books`, recursive filesystem discovery, folder categories, EPUB OPF/spine
and navigation/NCX parsing, section chunking, hash-based identities, progress reporting,
domain events, duplicate handling and error isolation. Added book metadata serialization to
Chroma, batches of 32 embeddings, prompt v5 with opaque `S1..Sn` labels, book response sources,
and accessible `Book` buttons in the graph.

Verification: five mandatory checks, 150 tests and five E2E tests passed.

**User:** “commit con mensaje 1”

Commit: `f9e157f`, `feat: ingest EPUB books and show book graph sources`.

## Phase 4: PDF ingestion and cleanup

**User:** “Implementa la Fase 4”

Implemented per-page PDF extraction, bookmark/named-destination chapter resolution, physical
page ranges and ten-page fallback sections. Added cleanup for running headers/footers,
page numbers, dotted TOC lines, ligatures and line-end hyphenation. Skipped Copyright,
Contents and Index sections. Textless PDFs report an empty result with the OCR limitation.

Blank page positions remain stable. Chunk page ranges are section-level, not exact
per-chunk page locations. Cleanup limitations are documented.

Verification: five mandatory checks and 162 tests passed.

**User:** “commit con mensaje 1”

Commit: `83dc06b`, `feat: ingest PDF books with chapter-aware text cleanup`.

## Phase 5: balanced retrieval

**User:** “Implementa la Fase 5”

Implemented source-type search filters and parallel book/post searches with one query
embedding and up to 20 candidates per type. Selection keeps the best chunk per source,
targets three books and two posts, fills shortfalls, and sorts by global relevance.
Distinct sections of one book count as separate sources. Finite overfetch can yield fewer
than five distinct sources; empty corpora fall back to the other type.

Verification: five mandatory checks and 177 tests passed.

**User:** “commit con mensaje 1”

Commit: `10af637`, `feat: balance book and post retrieval with source quotas`.

## Phase 6: guaranteed graph source coverage

**User:** “Implementa la Fase 6”

Implemented `attachMissingSources` after grounding, central-node resolution and depth pruning.
It attaches title-labelled provenance nodes directly to the centre with neutral
`retrieved source` edges, deterministic collision-free IDs and idempotent behaviour.
An empty successfully generated graph becomes a source-only graph; generation errors
retain the safe empty response. Seven nodes is an example, not a fixed size constraint.

Verification: five mandatory checks and 184 tests passed, including a seven-node case with
three book sources, two posts and two unsourced concepts.

**User:** “commit con mensaje 1”

Commit: `551fabf`, `feat: guarantee retrieved source coverage in graphs`.

## Phase 7: incremental book ingestion

**User:** “Implementa la Fase 7”

Implemented the `ingested_books` Prisma model/migration, repository port and adapter,
`SaveIngestedBookCommand`, `SaveIngestedBookOnBookIngested`, and `IngestedBookSaved`.
Normal runs load known hashes once and skip embedding/upserting known books. `--full`
bypasses the registry. Readers still parse files to obtain content hashes.

The table uses the agreed hash primary key and includes audit timestamps. Registry entries
are saved after successful Chroma persistence. Empty/failed books are not registered.
After Chroma data loss use `--full`; changing file contents creates a new identity and
does not delete old chunks. Subscriber failures are logged and retried on the next run.

Verification: regenerated Prisma Client, validated schema, five mandatory checks and
190 tests passed. The new migration has not yet been deployed to the local database.

The assistant marked all seven phases complete and suggested:

1. `feat: persist books for incremental ingestion`
2. `refactor: track book ingestion through domain events`
3. `test: verify incremental books and forced reingestion`

**User:** “commit con mensaje 1 y exportas la conversacion junto al plan”

This conversation record was created for inclusion with the Phase 7 commit using message 1.

## Remaining operational step

Before running incremental book ingestion, apply the PostgreSQL migration:

```sh
pnpm --filter @thenodewalk/api prisma:deploy
```

No push or pull request has been performed in this recorded implementation sequence.
