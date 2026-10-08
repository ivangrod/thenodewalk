import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

import { backfillPostSourceType } from '../chroma/backfill-post-source-type';
import { chromaClientArgsFromUrl } from '../chroma/chroma-collection.provider';
import { KNOWLEDGE_CHUNKS_COLLECTION } from '../chroma/chroma-knowledge-chunk.repository';
import { PrecomputedEmbeddingFunction } from '../chroma/precomputed-embedding-function';

async function run(): Promise<void> {
  const envPath = resolve(__dirname, '../../../../.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
  if (process.argv.length > 2) throw new Error('Usage: chroma:migrate');
  const client = new ChromaClient(
    chromaClientArgsFromUrl(process.env.CHROMA_URL ?? 'http://localhost:8000'),
  );
  const collection = await client.getCollection({
    name: KNOWLEDGE_CHUNKS_COLLECTION,
    embeddingFunction: new PrecomputedEmbeddingFunction(),
  });
  const updated = await backfillPostSourceType({
    get: (params) => collection.get(params),
    update: (params) => collection.update(params),
  });
  new Logger('ChromaMigrateCli').log(`Done: ${updated} post chunks migrated (metadata only).`);
}

run().catch((error: unknown) => {
  new Logger('ChromaMigrateCli').error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
