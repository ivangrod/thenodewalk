import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/infrastructure/shared.module';
import { IngestFeedsCommand } from '../application/ingest-feeds.command';
import {
  ARTICLE_FEED_READER,
  EMBEDDING_GENERATOR,
  FEED_SUBSCRIPTION_READER,
  KNOWLEDGE_CHUNK_REPOSITORY,
  READABLE_ARTICLE_READER,
} from '../application/knowledge.tokens';
import type { EmbeddingGenerator } from '../domain/embedding-generator';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import { ReadabilityArticleReader } from './article/readability-article.reader';
import {
  ChromaClientCollectionProvider,
  chromaClientArgsFromUrl,
} from './chroma/chroma-collection.provider';
import {
  ChromaKnowledgeChunkRepository,
  KNOWLEDGE_CHUNKS_COLLECTION,
} from './chroma/chroma-knowledge-chunk.repository';
import { OpmlFeedSubscriptionReader } from './feed/opml-feed-subscription.reader';
import { RssArticleFeedReader } from './feed/rss-article-feed.reader';
import { createOllamaEmbeddingGenerator } from './ollama/ollama-embedding-generator';
import { ChromaClient } from 'chromadb';

const DEFAULT_CHROMA_URL = 'http://localhost:8000';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * Wires the `knowledge` ingestion context: binds every domain port to its
 * concrete adapter and exposes the {@link IngestFeedsCommand}.
 */
@Module({
  imports: [SharedModule],
  providers: [
    IngestFeedsCommand,
    { provide: FEED_SUBSCRIPTION_READER, useClass: OpmlFeedSubscriptionReader },
    { provide: ARTICLE_FEED_READER, useClass: RssArticleFeedReader },
    { provide: READABLE_ARTICLE_READER, useClass: ReadabilityArticleReader },
    {
      provide: EMBEDDING_GENERATOR,
      useFactory: (): EmbeddingGenerator =>
        createOllamaEmbeddingGenerator(
          process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
          process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
        ),
    },
    {
      provide: KNOWLEDGE_CHUNK_REPOSITORY,
      useFactory: (): KnowledgeChunkRepository =>
        new ChromaKnowledgeChunkRepository(
          new ChromaClientCollectionProvider(
            new ChromaClient(chromaClientArgsFromUrl(process.env.CHROMA_URL ?? DEFAULT_CHROMA_URL)),
            KNOWLEDGE_CHUNKS_COLLECTION,
          ),
        ),
    },
  ],
  exports: [IngestFeedsCommand],
})
export class KnowledgeModule {}
