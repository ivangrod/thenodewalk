import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import type { IngestedBook } from '../../domain/ingested-book';
import type { IngestedBookRepository } from '../../domain/ingested-book-repository';

@Injectable()
export class PrismaIngestedBookRepository implements IngestedBookRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAllIds(): Promise<Set<string>> {
    const books = await this.prisma.ingestedBook.findMany({ select: { bookId: true } });
    return new Set(books.map(({ bookId }) => bookId));
  }

  async save(book: IngestedBook): Promise<void> {
    const data = { ...book, ingestedAt: new Date(book.ingestedAt) };
    await this.prisma.ingestedBook.upsert({
      where: { bookId: book.bookId },
      create: data,
      update: data,
    });
  }
}
