# Synthetic book fixtures

These files contain original, generated sample text, not extracts from published books.
The Node Walk contributors dedicate the fixture content to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

- `sample.epub`: EPUB 3 with container, OPF metadata, navigation and one XHTML chapter.
- `sample.pdf`: two text pages, title/author metadata and two outline entries with page destinations.
- `generate.ts`: reproducible generator using JSZip and a minimal PDF writer with byte-correct xref offsets.

From `apps/api`, regenerate them with:

```sh
pnpm exec ts-node test/fixtures/books/generate.ts
```

Verify the actual dependencies in each runtime from the repository root:

```sh
pnpm --filter @thenodewalk/api books:verify
pnpm --filter @thenodewalk/api build
pnpm --filter @thenodewalk/api exec node dist/src/knowledge/infrastructure/cli/verify-book-parsing.js
pnpm --filter @thenodewalk/api test --runInBand book-parsing-libraries
```

## Dependency decision

- `jszip@3.10.2` reads EPUB archives; the existing `jsdom` reads their XHTML.
- `unpdf@1.8.1` provides CommonJS exports and bundled serverless PDF.js. The document
  proxy exposes per-page text, metadata, outlines and `getPageIndex` for resolving chapter
  destinations. No separate `pdfjs-dist` or native canvas dependency is needed for text extraction.
- `pdfjs-dist@6.4.299` exposes an ESM entrypoint and would require additional module/worker
  integration in this CommonJS project. It was assessed via its package metadata.
- `pdf-parse@2.4.5` was trialled: it also requires Jest VM-module support for its PDF.js
  worker, installs a native canvas dependency, and exposes raw outline destinations without
  a public document proxy for resolving them to page indices. It was removed after the trial.

Both `unpdf` and `pdf-parse` failed in standard Jest due to dynamic ESM imports. API test and
coverage scripts enable Node's `--experimental-vm-modules` flag. The application remains
CommonJS; `ts-node` and compiled execution require no additional flags. The API requires Node
22 or newer, matching the existing repository engine requirement.
