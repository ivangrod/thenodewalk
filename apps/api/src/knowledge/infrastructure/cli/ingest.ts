import 'reflect-metadata';

import { resolve } from 'node:path';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { IngestFeedsCommand } from '../../application/ingest-feeds.command';
import { KnowledgeModule } from '../knowledge.module';

const DEFAULT_OPML_PATH = 'feeds/engineering_blogs.opml';

/**
 * Runnable ingestion entrypoint. Usage:
 *
 *   pnpm --filter @thenodewalk/api ingest [path/to/feeds.opml]
 *
 * Requires ChromaDB (`pnpm infra:up`) and Ollama running locally with the
 * embedding model pulled.
 */
async function run(): Promise<void> {
  const logger = new Logger('IngestFeedsCli');
  const opmlPath = resolve(process.argv[2] ?? DEFAULT_OPML_PATH);

  const context = await NestFactory.createApplicationContext(KnowledgeModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    logger.log(`Ingesting feeds from ${opmlPath}`);
    const result = await context.get(IngestFeedsCommand).execute(opmlPath);
    logger.log(
      `Done: ${result.processedFeeds} feeds, ${result.processedArticles} articles, ${result.indexedChunks} chunks indexed.`,
    );
  } finally {
    await context.close();
  }
}

run().catch((error: unknown) => {
  new Logger('IngestFeedsCli').error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
