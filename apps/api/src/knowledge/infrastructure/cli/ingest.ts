import 'reflect-metadata';

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { IngestFeedsCommand } from '../../application/ingest-feeds.command';
import { KnowledgeModule } from '../knowledge.module';

const DEFAULT_OPML_PATH = 'feeds/engineering_blogs.opml';

/**
 * Runnable ingestion entrypoint. Usage:
 *
 *   pnpm --filter @thenodewalk/api ingest [--full] [path/to/feeds.opml]
 *
 * Requires migrated PostgreSQL, ChromaDB (`pnpm infra:up`) and Ollama running locally with the
 * embedding model pulled.
 */
async function run(): Promise<void> {
  const logger = new Logger('IngestFeedsCli');
  const envPath = resolve(__dirname, '../../../../.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Copy apps/api/.env.example to apps/api/.env or export DATABASE_URL before running ingestion.',
    );
  }
  const args = process.argv.slice(2);
  const paths = args.filter((argument) => argument !== '--full');
  if (paths.length > 1 || paths.some((argument) => argument.startsWith('--'))) {
    throw new Error('Usage: ingest [--full] [path/to/feeds.opml]');
  }
  const opmlPath = resolve(paths[0] ?? DEFAULT_OPML_PATH);

  const context = await NestFactory.createApplicationContext(KnowledgeModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    logger.log(`Ingesting feeds from ${opmlPath}`);
    const result = await context
      .get(IngestFeedsCommand)
      .execute(opmlPath, { full: args.includes('--full') });
    logger.log(
      `Done: ${result.processedFeeds} feeds, ${result.processedArticles} articles, ${result.indexedChunks} chunks indexed, ${result.skippedArticles} articles already ingested.`,
    );

    if (result.issues.length > 0) {
      logger.warn(`${result.issues.length} feed(s) need attention:`);
      for (const issue of result.issues) {
        logger.warn(`  - [${issue.type}] ${issue.blogName} (${issue.feedUrl}): ${issue.reason}`);
      }
    }
  } finally {
    await context.close();
  }
}

run().catch((error: unknown) => {
  new Logger('IngestFeedsCli').error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
