import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/infrastructure/shared.module';
import { AnswerTechnicalQueryQuery } from '../application/answer-technical-query.query';
import { IngestFeedsCommand } from '../application/ingest-feeds.command';
import {
  ARTICLE_FEED_READER,
  EMBEDDING_GENERATOR,
  FEED_SUBSCRIPTION_READER,
  KNOWLEDGE_CHUNK_REPOSITORY,
  READABLE_ARTICLE_READER,
  STRUCTURED_GRAPH_GENERATOR,
} from '../application/knowledge.tokens';
import type { ArticleFeedReader } from '../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../domain/embedding-generator';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import type { ReadableArticleReader } from '../domain/readable-article-reader';
import type { StructuredGraphGenerator } from '../domain/structured-graph-generator';
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
import { TechnicalQueryController } from './http/technical-query.controller';
import { createOllamaEmbeddingGenerator } from './ollama/ollama-embedding-generator';
import { createOllamaStructuredGraphGenerator } from './ollama/ollama-structured-graph-generator';
import { ChromaClient } from 'chromadb';

const DEFAULT_CHROMA_URL = 'http://localhost:8000';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';
const DEFAULT_LLM_MODEL = 'llama3.1:8b';

/**
 * Wires the `knowledge` context: binds every domain port to its concrete adapter
 * and exposes the ingestion command and the technical-query endpoint.
 */
@Module({
  imports: [SharedModule],
  controllers: [TechnicalQueryController],
  providers: [
    IngestFeedsCommand,
    AnswerTechnicalQueryQuery,
    { provide: FEED_SUBSCRIPTION_READER, useClass: OpmlFeedSubscriptionReader },
    {
      provide: ARTICLE_FEED_READER,
      useFactory: (): ArticleFeedReader => new RssArticleFeedReader(),
    },
    {
      provide: READABLE_ARTICLE_READER,
      useFactory: (): ReadableArticleReader => new ReadabilityArticleReader(),
    },
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
    {
      provide: STRUCTURED_GRAPH_GENERATOR,
      useFactory: (): StructuredGraphGenerator =>
        createOllamaStructuredGraphGenerator(
          process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
          process.env.OLLAMA_LLM_MODEL ?? DEFAULT_LLM_MODEL,
        ),
    },
  ],
  exports: [IngestFeedsCommand, AnswerTechnicalQueryQuery],
})
export class KnowledgeModule {}
