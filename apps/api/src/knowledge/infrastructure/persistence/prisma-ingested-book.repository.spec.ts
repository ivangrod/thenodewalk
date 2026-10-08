import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { PrismaIngestedBookRepository } from './prisma-ingested-book.repository';

describe('PrismaIngestedBookRepository', () => {
  it('reads only book identities and maps timestamps in idempotent upserts', async () => {
    const findMany = jest.fn().mockResolvedValue([{ bookId: 'hash' }]);
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { ingestedBook: { findMany, upsert } } as unknown as PrismaService;
    const repository = new PrismaIngestedBookRepository(prisma);
    expect(await repository.findAllIds()).toEqual(new Set(['hash']));
    expect(findMany).toHaveBeenCalledWith({ select: { bookId: true } });
    const book = {
      bookId: 'hash',
      title: 'Book',
      filePath: '/books/book.pdf',
      chunkCount: 2,
      ingestedAt: '2026-10-08T10:00:00Z',
    };
    await repository.save(book);
    expect(upsert).toHaveBeenCalledWith({
      where: { bookId: 'hash' },
      create: { ...book, ingestedAt: new Date(book.ingestedAt) },
      update: { ...book, ingestedAt: new Date(book.ingestedAt) },
    });
  });
});
