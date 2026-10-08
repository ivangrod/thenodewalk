import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { IngestBooksCommand } from '../../application/ingest-books.command';
import {
  CHROMA_COLLECTION_PROVIDER,
  type ChromaCollectionProvider,
} from '../chroma/chroma-collection.provider';
import { KnowledgeModule } from '../knowledge.module';

async function run(): Promise<void> {
  const logger = new Logger('IngestBooksCli');
  const apiRoot = resolve(__dirname, '../../../..');
  const envPath = resolve(apiRoot, '.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
  const args = process.argv.slice(2);
  const paths = args.filter((argument) => argument !== '--full');
  if (paths.length > 1 || paths.some((argument) => argument.startsWith('--'))) {
    throw new Error('Usage: ingest:books [--full] [path/to/books]');
  }
  const booksDir = resolve(paths[0] ?? process.env.BOOKS_DIR ?? resolve(apiRoot, 'books'));
  const context = await NestFactory.createApplicationContext(KnowledgeModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    await context.get<ChromaCollectionProvider>(CHROMA_COLLECTION_PROVIDER).collection();
    const result = await context
      .get(IngestBooksCommand)
      .execute(booksDir, { full: args.includes('--full') });
    logger.log(
      `Done: ${result.processedBooks} books, ${result.indexedChunks} chunks, ${result.skippedBooks} skipped books.`,
    );
    for (const issue of result.issues)
      logger.warn(`[${issue.type}] ${issue.filePath}: ${issue.reason}`);
  } finally {
    await context.close();
  }
}

run().catch((error: unknown) => {
  new Logger('IngestBooksCli').error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
