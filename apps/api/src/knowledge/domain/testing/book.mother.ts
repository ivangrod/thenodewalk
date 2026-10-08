import { faker } from '@faker-js/faker';

import type { BookContent, BookFile } from '../book-content-reader';
import {
  createKnowledgeChunk,
  type BookChunkMetadata,
  type KnowledgeChunk,
} from '../knowledge-chunk';

export class BookFileMother {
  static create(params?: Partial<BookFile>): BookFile {
    return {
      filePath: `/books/${faker.string.uuid()}.epub`,
      format: 'epub',
      category: 'AGILE',
      ...params,
    };
  }
}

export class BookContentMother {
  static create(params?: Partial<BookContent>): BookContent {
    return {
      contentHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      title: faker.lorem.words(3),
      authors: [faker.person.fullName()],
      sections: [
        {
          index: 0,
          title: 'Feedback',
          text: 'Small feedback loops improve engineering.',
          pageStart: null,
          pageEnd: null,
        },
      ],
      ...params,
    };
  }
}

export class BookChunkMother {
  static create(params?: Partial<BookChunkMetadata>): KnowledgeChunk {
    const bookId = params?.bookId ?? faker.string.uuid();
    const sectionIndex = params?.sectionIndex ?? 0;
    return createKnowledgeChunk({
      document: 'Book content',
      embedding: [0.1, 0.2],
      metadata: {
        sourceType: 'book',
        sourceId: `${bookId}#${sectionIndex}`,
        bookId,
        bookTitle: 'Engineering Feedback',
        authors: ['The Node Walk'],
        format: 'epub',
        sectionTitle: 'Feedback',
        sectionIndex,
        chunkIndex: 0,
        filePath: '/books/feedback.epub',
        ...params,
      },
    });
  }
}
