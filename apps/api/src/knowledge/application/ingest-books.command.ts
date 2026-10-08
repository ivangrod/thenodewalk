import { Inject, Injectable } from '@nestjs/common';

import { EVENT_BUS } from '../../shared/application/event-bus.token';
import type { EventBus } from '../../shared/domain/event-bus';
import { UnsupportedBookFormatError, type BookContentReader } from '../domain/book-content-reader';
import type { BookLibraryReader } from '../domain/book-library-reader';
import type { BookIngestionProgressReporter } from '../domain/book-ingestion-progress-reporter';
import type { EmbeddingGenerator } from '../domain/embedding-generator';
import { BookIngested } from '../domain/events/book-ingested';
import { BookIngestionFailed } from '../domain/events/book-ingestion-failed';
import { BooksIngestionCompleted } from '../domain/events/books-ingestion-completed';
import {
  createKnowledgeChunk,
  type BookChunkMetadata,
  type KnowledgeChunk,
} from '../domain/knowledge-chunk';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import { chunkText } from '../domain/text-chunker';
import {
  BOOK_CONTENT_READER,
  BOOK_LIBRARY_READER,
  BOOK_INGESTION_PROGRESS_REPORTER,
  EMBEDDING_GENERATOR,
  KNOWLEDGE_CHUNK_REPOSITORY,
} from './knowledge.tokens';

export interface BookIngestionIssue {
  filePath: string;
  type: 'unreadable' | 'empty' | 'duplicate' | 'unsupported';
  reason: string;
}

export interface BookIngestionResult {
  processedBooks: number;
  indexedChunks: number;
  skippedBooks: number;
  issues: BookIngestionIssue[];
}

@Injectable()
export class IngestBooksCommand {
  constructor(
    @Inject(BOOK_LIBRARY_READER) private readonly library: BookLibraryReader,
    @Inject(BOOK_CONTENT_READER) private readonly reader: BookContentReader,
    @Inject(EMBEDDING_GENERATOR) private readonly embeddings: EmbeddingGenerator,
    @Inject(KNOWLEDGE_CHUNK_REPOSITORY) private readonly repository: KnowledgeChunkRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    @Inject(BOOK_INGESTION_PROGRESS_REPORTER)
    private readonly progress: BookIngestionProgressReporter,
  ) {}

  async execute(booksDir: string, _options: { full?: boolean } = {}): Promise<BookIngestionResult> {
    // All books are re-ingested until the incremental registry is introduced.
    void _options;
    const { books, unsupported } = await this.library.list(booksDir);
    const result: BookIngestionResult = {
      processedBooks: 0,
      indexedChunks: 0,
      skippedBooks: 0,
      issues: unsupported.map((filePath) => ({
        filePath,
        type: 'unsupported',
        reason: 'Only EPUB and PDF files are supported',
      })),
    };
    const storedHashes = new Set<string>();
    for (const [index, file] of books.entries()) {
      const progress = { position: index + 1, total: books.length, filePath: file.filePath };
      this.progress.bookStarted(progress);
      try {
        const content = await this.reader.read(file);
        if (storedHashes.has(content.contentHash)) {
          result.skippedBooks++;
          result.issues.push({
            filePath: file.filePath,
            type: 'duplicate',
            reason: 'Identical book content already indexed in this run',
          });
          this.progress.bookCompleted(progress, { sections: 0, chunks: 0 });
          continue;
        }
        const pending: { document: string; metadata: BookChunkMetadata }[] = [];
        for (const section of content.sections) {
          for (const [chunkIndex, document] of chunkText(section.text).entries()) {
            pending.push({
              document,
              metadata: {
                sourceType: 'book',
                sourceId: `${content.contentHash}#${section.index}`,
                bookId: content.contentHash,
                bookTitle: content.title,
                authors: content.authors,
                format: file.format,
                sectionTitle: section.title,
                sectionIndex: section.index,
                chunkIndex,
                filePath: file.filePath,
                ...(file.category === null ? {} : { category: file.category }),
                ...(section.pageStart === null ? {} : { pageStart: section.pageStart }),
                ...(section.pageEnd === null ? {} : { pageEnd: section.pageEnd }),
              },
            });
          }
        }
        if (pending.length === 0) {
          result.issues.push({
            filePath: file.filePath,
            type: 'empty',
            reason: 'No extractable book text',
          });
          result.processedBooks++;
          this.progress.bookCompleted(progress, { sections: content.sections.length, chunks: 0 });
          continue;
        }
        const vectors = await this.embeddings.embedDocuments(
          pending.map(({ document }) => document),
        );
        const chunks: KnowledgeChunk[] = pending.map((chunk, chunkIndex) => {
          const embedding = vectors[chunkIndex];
          if (embedding === undefined)
            throw new Error(`Missing embedding for book chunk ${chunkIndex}`);
          return createKnowledgeChunk({ ...chunk, embedding });
        });
        await this.repository.upsert(chunks);
        storedHashes.add(content.contentHash);
        result.processedBooks++;
        result.indexedChunks += chunks.length;
        await this.eventBus.publish([
          new BookIngested(
            content.contentHash,
            content.title,
            file.filePath,
            chunks.length,
            new Date().toISOString(),
          ),
        ]);
        this.progress.bookCompleted(progress, {
          sections: content.sections.length,
          chunks: chunks.length,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        result.issues.push({
          filePath: file.filePath,
          type: error instanceof UnsupportedBookFormatError ? 'unsupported' : 'unreadable',
          reason,
        });
        this.progress.bookFailed(progress, reason);
        await this.eventBus.publish([
          new BookIngestionFailed(file.filePath, reason, new Date().toISOString()),
        ]);
      }
    }
    await this.eventBus.publish([
      new BooksIngestionCompleted(
        result.processedBooks,
        result.indexedChunks,
        new Date().toISOString(),
      ),
    ]);
    return result;
  }
}
