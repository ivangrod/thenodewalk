import {
  UnsupportedBookFormatError,
  type BookContent,
  type BookFile,
} from '../domain/book-content-reader';
import { BookContentMother, BookFileMother } from '../domain/testing/book.mother';
import { IngestBooksCommand } from './ingest-books.command';
import {
  RecordingBookProgress,
  StubBookContentReader,
  StubBookLibraryReader,
} from './testing/book-test-doubles';
import {
  InMemoryKnowledgeChunkRepository,
  RecordingEventBus,
  StubEmbeddingGenerator,
} from './testing/knowledge-test-doubles';

function scenario(
  books: BookFile[],
  contents: Map<string, BookContent | Error>,
  unsupported: string[] = [],
): {
  command: IngestBooksCommand;
  repository: InMemoryKnowledgeChunkRepository;
  bus: RecordingEventBus;
  progress: RecordingBookProgress;
} {
  const repository = new InMemoryKnowledgeChunkRepository();
  const bus = new RecordingEventBus();
  const progress = new RecordingBookProgress();
  return {
    repository,
    bus,
    progress,
    command: new IngestBooksCommand(
      new StubBookLibraryReader(books, unsupported),
      new StubBookContentReader(contents),
      new StubEmbeddingGenerator([0.1, 0.2]),
      repository,
      bus,
      progress,
    ),
  };
}

describe('IngestBooksCommand', () => {
  it('reports a scanned PDF without text as empty with the OCR limitation', async () => {
    const file = BookFileMother.create({ format: 'pdf' });
    const { command, repository } = scenario(
      [file],
      new Map([[file.filePath, BookContentMother.create({ sections: [] })]]),
    );
    const result = await command.execute('/books');
    expect(result.issues).toEqual([
      {
        filePath: file.filePath,
        type: 'empty',
        reason: 'No extractable text (scanned PDF? OCR not supported)',
      },
    ]);
    expect(repository.store.size).toBe(0);
  });
  it('indexes sections separately, stores category and publishes events after persistence', async () => {
    const file = BookFileMother.create();
    const content = BookContentMother.create();
    content.sections.push({
      index: 1,
      title: 'Tests',
      text: 'Tests preserve behaviour.',
      pageStart: null,
      pageEnd: null,
    });
    const { command, repository, bus, progress } = scenario(
      [file],
      new Map([[file.filePath, content]]),
    );
    const publish = jest.spyOn(bus, 'publish');
    publish.mockImplementation(async (events): Promise<void> => {
      if (events.some((event) => event.eventName === 'knowledge.book.ingested'))
        expect(repository.store.size).toBe(2);
      bus.published.push(...events);
    });
    expect(await command.execute('/books')).toMatchObject({
      processedBooks: 1,
      indexedChunks: 2,
      issues: [],
    });
    expect([...repository.store.values()].map(({ metadata }) => metadata)).toEqual([
      expect.objectContaining({
        sourceType: 'book',
        sourceId: `${content.contentHash}#0`,
        category: 'AGILE',
        sectionIndex: 0,
      }),
      expect.objectContaining({
        sourceType: 'book',
        sourceId: `${content.contentHash}#1`,
        sectionIndex: 1,
      }),
    ]);
    expect(bus.ofType('knowledge.book.ingested')).toHaveLength(1);
    expect(bus.ofType('knowledge.books.ingestion.completed')).toHaveLength(1);
    expect(progress.reports.map(({ status }) => status)).toEqual(['started', 'completed']);
  });

  it('deduplicates identical content within a run', async () => {
    const first = BookFileMother.create();
    const copy = BookFileMother.create();
    const content = BookContentMother.create();
    const { command, repository } = scenario(
      [first, copy],
      new Map([
        [first.filePath, content],
        [copy.filePath, content],
      ]),
    );
    expect(await command.execute('/books')).toMatchObject({
      skippedBooks: 1,
      indexedChunks: 1,
      issues: [expect.objectContaining({ type: 'duplicate' })],
    });
    expect(repository.upsertCalls).toHaveLength(1);
  });

  it('reports empty and unsupported books, isolates errors and continues', async () => {
    const files = Array.from({ length: 4 }, () => BookFileMother.create());
    const [broken, empty, pdf, healthy] = files as [BookFile, BookFile, BookFile, BookFile];
    const { command, bus, progress } = scenario(
      files,
      new Map<string, BookContent | Error>([
        [broken.filePath, new Error('corrupt archive')],
        [empty.filePath, BookContentMother.create({ sections: [] })],
        [pdf.filePath, new UnsupportedBookFormatError('pdf')],
        [healthy.filePath, BookContentMother.create()],
      ]),
      ['/books/book.mobi'],
    );
    const result = await command.execute('/books');
    expect(result.indexedChunks).toBe(1);
    expect(result.issues.map(({ type }) => type)).toEqual([
      'unsupported',
      'unreadable',
      'empty',
      'unsupported',
    ]);
    expect(bus.ofType('knowledge.book.ingestion.failed')).toHaveLength(2);
    expect(bus.ofType('knowledge.books.ingestion.completed')).toHaveLength(1);
    expect(progress.reports.map(({ status }) => status)).toEqual([
      'started',
      'failed',
      'started',
      'completed',
      'started',
      'failed',
      'started',
      'completed',
    ]);
  });

  it('retries duplicate content through another file after persistence fails', async () => {
    const first = BookFileMother.create();
    const copy = BookFileMother.create();
    const content = BookContentMother.create();
    const { command, repository } = scenario(
      [first, copy],
      new Map([
        [first.filePath, content],
        [copy.filePath, content],
      ]),
    );
    jest.spyOn(repository, 'upsert').mockRejectedValueOnce(new Error('Chroma unavailable'));
    expect(await command.execute('/books')).toMatchObject({
      processedBooks: 1,
      skippedBooks: 0,
      indexedChunks: 1,
    });
    expect(repository.store.size).toBe(1);
  });
});
