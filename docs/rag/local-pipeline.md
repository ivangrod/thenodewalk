# TechGraph RAG Local Pipeline

## Convention

The TechGraph RAG pipeline lives in the `knowledge` context in `apps/api` and stays
fully local:

1. `IngestFeedsCommand` is a Command. It reads OPML subscriptions, fetches RSS entries,
   extracts readable article text, chunks it, generates embeddings with Ollama, and
   idempotently upserts the chunks into ChromaDB.
2. Chunk identifiers must be deterministic (`sha256(articleUrl#chunkIndex)`) so a repeat
   ingestion updates the existing vector rather than creating duplicates.
3. Ingestion publishes `KnowledgeIngestionCompleted` for every completed run and
   `KnowledgeIngestionFailed` for an individual feed failure. A failed feed must not stop
   the remaining subscriptions.
4. `AnswerTechnicalQueryQuery` is a read-only Query. It embeds the question once, retrieves
   the Top-K `KnowledgeSearchMatch` values, and must not mutate state or publish events.
5. A `StructuredGraphGenerator` receives the query plus traceable chunks (document text and
   source URL) and returns a summary and graph. Its Ollama adapter uses a versioned system
   prompt, JSON mode, deterministic generation, and runtime validation before the answer
   reaches the HTTP contract.
6. Domain ports stay framework-free. ChromaDB, Ollama, OPML/RSS/Readability, NestJS
   controllers, and injection-token bindings belong in infrastructure.
7. Infrastructure adapters with constructor collaborators that Nest cannot resolve must use
   an explicit `useFactory` provider. Default constructor values do not stop Nest from trying
   to inject their runtime type.

The public `POST /technical-queries` response is always `{ summary, graph }`. A graph node
contains a `sourceUrl` so the web client can link the generated concept to its source.

## Benefits

- Keeps ingestion repeatable and prevents duplicate vector records on re-runs.
- Separates write-side failures from the read-only query path required by CQRS.
- Makes every generated concept traceable to retrieved engineering material.
- Allows ChromaDB and Ollama adapters to be replaced or tested with hand-written doubles.
- Prevents Nest dependency-injection failures that only appear when the full API boots.
- Constrains unreliable LLM output before it crosses the API boundary.

## Examples

### ✅ Good: Command ingestion through domain ports with deterministic chunks

```typescript
@Injectable()
export class IngestFeedsCommand {
  constructor(
    @Inject(EMBEDDING_GENERATOR) private readonly embeddings: EmbeddingGenerator,
    @Inject(KNOWLEDGE_CHUNK_REPOSITORY) private readonly repository: KnowledgeChunkRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async execute(opmlPath: string): Promise<IngestionResult> {
    // Read subscriptions, fetch articles, extract text and chunk it.
    const embedding = await this.embeddings.generate(document);
    chunks.push(
      createKnowledgeChunk({
        document,
        embedding,
        metadata: { articleUrl, chunkIndex, ...metadata },
      }),
    );

    await this.repository.upsert(chunks);
    await this.eventBus.publish([new KnowledgeIngestionCompleted(/* totals */)]);
  }
}
```

### ✅ Good: Read-only query with structured-generation fallback

```typescript
async execute(query: string): Promise<TechnicalQueryResponse> {
  const embedding = await this.embeddings.generate(query);
  const matches = await this.repository.search(embedding, TECHNICAL_QUERY_TOP_K);

  if (matches.length === 0) {
    return { summary: NO_CONTEXT_SUMMARY, graph: EMPTY_GRAPH };
  }

  try {
    return this.toResponse(await this.graphGenerator.generate(query, matches));
  } catch {
    return { summary: GENERATION_FAILURE_SUMMARY, graph: EMPTY_GRAPH };
  }
}
```

### ✅ Good: Explicit factory for adapters with local defaults

```typescript
{
  provide: ARTICLE_FEED_READER,
  useFactory: (): ArticleFeedReader => new RssArticleFeedReader(),
},
{
  provide: READABLE_ARTICLE_READER,
  useFactory: (): ReadableArticleReader => new ReadabilityArticleReader(),
},
```

### ❌ Bad: Controller coupled to vector and LLM clients

```typescript
@Post()
async ask(@Body('query') query: string) {
  // ChromaDB and Ollama details leak into the HTTP adapter.
  const embedding = await new Ollama().embeddings({ model: 'nomic-embed-text', prompt: query });
  const chunks = await new ChromaClient().getCollection({ name: 'knowledge_chunks' });
  return chunks.query({ queryEmbeddings: [embedding.embedding] });
}
```

### ❌ Bad: Query mutating state or publishing events

```typescript
async execute(query: string): Promise<TechnicalQueryResponse> {
  const answer = await this.generateAnswer(query);
  await this.repository.upsert(answer.chunks); // A Query must not write.
  await this.eventBus.publish([new TechnicalQueryAnswered()]); // Or publish events.
  return answer;
}
```

### ❌ Bad: Relying on a default constructor parameter as Nest DI

```typescript
// Nest reflects Parser and tries to inject it when this class is registered with useClass.
@Injectable()
export class RssArticleFeedReader {
  constructor(private readonly parser: Parser = new Parser()) {}
}

{ provide: ARTICLE_FEED_READER, useClass: RssArticleFeedReader }
```

## Real world examples

- Ingestion Command: `apps/api/src/knowledge/application/ingest-feeds.command.ts`
- Read-only RAG Query: `apps/api/src/knowledge/application/answer-technical-query.query.ts`
- Deterministic chunks and repository port: `apps/api/src/knowledge/domain/knowledge-chunk.ts` and `apps/api/src/knowledge/domain/knowledge-chunk-repository.ts`
- Structured Ollama adapter and JSON validation: `apps/api/src/knowledge/infrastructure/ollama/ollama-structured-graph-generator.ts`
- Port bindings and explicit reader factories: `apps/api/src/knowledge/infrastructure/knowledge.module.ts`
- Shared HTTP contract: `packages/contracts/src/index.ts`

## Related agreements

- [Hexagonal Architecture](../backend/hexagonal-architecture.md)
- [CQRS and Domain Events](../backend/cqrs-and-domain-events.md)
- [Dependency Injection](../backend/dependency-injection.md)
- [Shared Contracts](../monorepo/shared-contracts.md)
- [RAG Operations and Verification](operations-and-verification.md)

The local pipeline stays traceable from feed to graph thanks to 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
