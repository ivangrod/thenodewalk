import { SaveIngestedBookCommand } from './save-ingested-book.command';
import { SaveIngestedBookOnBookIngested } from './save-ingested-book-on-book-ingested';
import { InMemoryIngestedBookRepository } from './testing/book-test-doubles';
import { RecordingEventBus } from './testing/knowledge-test-doubles';
import { BookIngested } from '../domain/events/book-ingested';
import { BookContentMother, BookFileMother } from '../domain/testing/book.mother';

describe('SaveIngestedBookCommand', () => {
  it('saves a book from BookIngested and publishes IngestedBookSaved after persistence', async () => {
    const repository = new InMemoryIngestedBookRepository();
    const bus = new RecordingEventBus();
    const command = new SaveIngestedBookCommand(repository, bus);
    const content = BookContentMother.create();
    const file = BookFileMother.create();
    const event = new BookIngested(
      content.contentHash,
      content.title,
      file.filePath,
      3,
      '2026-10-08T10:00:00Z',
    );
    jest.spyOn(bus, 'publish').mockImplementation(async (events): Promise<void> => {
      expect(repository.store.has(event.bookId)).toBe(true);
      bus.published.push(...events);
    });
    await new SaveIngestedBookOnBookIngested(command).handle(event);
    expect(repository.store.get(event.bookId)).toEqual({
      bookId: event.bookId,
      title: event.title,
      filePath: event.filePath,
      chunkCount: 3,
      ingestedAt: event.occurredAt,
    });
    expect(bus.ofType('knowledge.ingested-book.saved')).toEqual([
      expect.objectContaining({ bookId: event.bookId }),
    ]);
  });

  it('does not emit success when saving fails', async () => {
    const repository = new InMemoryIngestedBookRepository();
    const bus = new RecordingEventBus();
    jest.spyOn(repository, 'save').mockRejectedValue(new Error('database down'));
    await expect(
      new SaveIngestedBookCommand(repository, bus).execute({
        bookId: 'hash',
        filePath: '/book.epub',
        title: 'Book',
        chunkCount: 1,
        ingestedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow('database down');
    expect(bus.published).toEqual([]);
  });
});
