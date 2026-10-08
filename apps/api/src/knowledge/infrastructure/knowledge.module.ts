import { Inject, Module, type OnModuleInit } from '@nestjs/common';

import { EVENT_SUBSCRIBER_REGISTRY } from '../../shared/application/event-bus.token';
import type { DomainEventSubscriberRegistry } from '../../shared/domain/domain-event-subscriber';
import { SaveLastPublicationDateCommand } from '../application/save-last-publication-date.command';
import { SaveLastPublicationDateOnKnowledgeFeedIngested } from '../application/save-last-publication-date-on-knowledge-feed-ingested';
import { PrismaFeedLastPublicationDateRepository } from './persistence/prisma-feed-last-publication-date.repository';

import { SharedModule } from '../../shared/infrastructure/shared.module';
import { AnswerTechnicalQueryQuery } from '../application/answer-technical-query.query';
import { IngestFeedsCommand } from '../application/ingest-feeds.command';
import { IngestBooksCommand } from '../application/ingest-books.command';
import {
  BOOK_CONTENT_READER,
  BOOK_LIBRARY_READER,
  BOOK_INGESTION_PROGRESS_REPORTER,
} from '../application/knowledge.tokens';
import { FsBookLibraryReader } from './books/fs-book-library.reader';
import { EpubBookContentReader } from './books/epub-book-content.reader';
import { CompositeBookContentReader } from './books/composite-book-content.reader';
import { LoggerBookIngestionProgressReporter } from './logging/logger-book-ingestion-progress-reporter';
import {
  ARTICLE_FEED_READER,
  EMBEDDING_GENERATOR,
  FEED_SUBSCRIPTION_READER,
  FEED_LAST_PUBLICATION_DATE_REPOSITORY,
  INGESTION_PROGRESS_REPORTER,
  KNOWLEDGE_CHUNK_REPOSITORY,
  READABLE_ARTICLE_READER,
  STRUCTURED_GRAPH_GENERATOR,
} from '../application/knowledge.tokens';
import type { ArticleFeedReader } from '../domain/article-feed-reader';
import type { EmbeddingGenerator } from '../domain/embedding-generator';
import type { IngestionProgressReporter } from '../domain/ingestion-progress-reporter';
import type { KnowledgeChunkRepository } from '../domain/knowledge-chunk-repository';
import type { ReadableArticleReader } from '../domain/readable-article-reader';
import type { StructuredGraphGenerator } from '../domain/structured-graph-generator';
import { ReadabilityArticleReader } from './article/readability-article.reader';
import {
  CHROMA_COLLECTION_PROVIDER,
  ChromaClientCollectionProvider,
  chromaClientArgsFromUrl,
  type ChromaCollectionProvider,
} from './chroma/chroma-collection.provider';
import {
  ChromaKnowledgeChunkRepository,
  KNOWLEDGE_CHUNKS_COLLECTION,
} from './chroma/chroma-knowledge-chunk.repository';
import { OpmlFeedSubscriptionReader } from './feed/opml-feed-subscription.reader';
import { RssArticleFeedReader } from './feed/rss-article-feed.reader';
import { TechnicalQueryController } from './http/technical-query.controller';
import { createLoggerIngestionProgressReporter } from './logging/logger-ingestion-progress-reporter';
import { createOllamaEmbeddingGenerator } from './ollama/ollama-embedding-generator';
import {
  createOllamaStructuredGraphGenerator,
  ollamaGenerationSettingsFromEnv,
} from './ollama/ollama-structured-graph-generator';
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
    IngestBooksCommand,
    { provide: BOOK_LIBRARY_READER, useClass: FsBookLibraryReader },
    {
      provide: BOOK_CONTENT_READER,
      useFactory: (): CompositeBookContentReader =>
        new CompositeBookContentReader(new EpubBookContentReader()),
    },
    { provide: BOOK_INGESTION_PROGRESS_REPORTER, useClass: LoggerBookIngestionProgressReporter },
    SaveLastPublicationDateCommand,
    SaveLastPublicationDateOnKnowledgeFeedIngested,
    {
      provide: FEED_LAST_PUBLICATION_DATE_REPOSITORY,
      useClass: PrismaFeedLastPublicationDateRepository,
    },
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
      provide: CHROMA_COLLECTION_PROVIDER,
      useFactory: (): ChromaCollectionProvider =>
        new ChromaClientCollectionProvider(
          new ChromaClient(chromaClientArgsFromUrl(process.env.CHROMA_URL ?? DEFAULT_CHROMA_URL)),
          KNOWLEDGE_CHUNKS_COLLECTION,
        ),
    },
    {
      provide: KNOWLEDGE_CHUNK_REPOSITORY,
      useFactory: (collections: ChromaCollectionProvider): KnowledgeChunkRepository =>
        new ChromaKnowledgeChunkRepository(collections),
      inject: [CHROMA_COLLECTION_PROVIDER],
    },
    {
      provide: STRUCTURED_GRAPH_GENERATOR,
      useFactory: (): StructuredGraphGenerator =>
        createOllamaStructuredGraphGenerator(
          process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
          process.env.OLLAMA_LLM_MODEL ?? DEFAULT_LLM_MODEL,
          ollamaGenerationSettingsFromEnv({
            contextLength: process.env.OLLAMA_LLM_CONTEXT_LENGTH,
            keepAlive: process.env.OLLAMA_LLM_KEEP_ALIVE,
          }),
        ),
    },
    {
      provide: INGESTION_PROGRESS_REPORTER,
      useFactory: (): IngestionProgressReporter => createLoggerIngestionProgressReporter(),
    },
  ],
  exports: [IngestFeedsCommand, IngestBooksCommand, AnswerTechnicalQueryQuery],
})
export class KnowledgeModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_SUBSCRIBER_REGISTRY) private readonly registry: DomainEventSubscriberRegistry,
    private readonly subscriber: SaveLastPublicationDateOnKnowledgeFeedIngested,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.subscriber);
  }
}
