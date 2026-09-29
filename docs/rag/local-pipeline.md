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
8. Chroma collections store precomputed vectors only. Resolve them with the explicit
   `PrecomputedEmbeddingFunction` guard so the SDK never falls back to its
   `DefaultEmbeddingFunction`, and do not install `@chroma-core/default-embed`. Embeddings are
   produced exclusively through the `EmbeddingGenerator` port.
9. Ingestion reports the progress of every feed (`[position/total]`, `in progress`,
   `completed` with its article and chunk totals, or `failed` with its reason) through the
   `IngestionProgressReporter` domain port, implemented by a Nest `Logger` adapter. Progress is
   not a state change, so it must not be modelled as domain events.
10. Within a single graph, a post is linked to at most one node, and a node can only be linked
    to a post retrieved as context. `AnswerTechnicalQueryQuery` enforces it with the pure
    domain function `assignUniqueSources`: the first node (in graph order) that references a
    retrieved post keeps it, and any duplicate or non-retrieved source becomes `null`. Nodes
    and edges are never dropped by this rule. The system prompt asks the LLM for the same
    rule, but the domain function is the source of truth.
11. Every graph revolves around a central node: the node holding the main idea of the most
    relevant post. No node can be more than `MAX_GRAPH_DEPTH` (3) levels away from it.
    `AnswerTechnicalQueryQuery` enforces it after `assignUniqueSources` with two pure domain
    functions: `resolveCentralNodeId` keeps the central node proposed by the LLM when it
    exists, and otherwise falls back to the first node linked to the top-ranked post, then to
    the first node. Then `limitGraphDepth` walks the graph breadth-first from the central node,
    ignoring edge direction, and drops farther or disconnected nodes together with their edges.
    The system prompt asks for the same rule, but the domain functions are the source of truth.

The public `POST /technical-queries` response is always `{ summary, graph }`. A graph node
contains a `sourceUrl: string | null`: the post (ingested article) linked to the concept so the
web client can link it to its source, or `null` when the concept has no post. The parser
normalizes a missing or empty `sourceUrl` to `null` instead of dropping the node. The graph
exposes `centralNodeId: string | null`, which is `null` only when the graph has no nodes.

## Benefits

- Keeps ingestion repeatable and prevents duplicate vector records on re-runs.
- Separates write-side failures from the read-only query path required by CQRS.
- Makes every generated concept traceable to retrieved engineering material.
- Allows ChromaDB and Ollama adapters to be replaced or tested with hand-written doubles.
- Prevents Nest dependency-injection failures that only appear when the full API boots.
- Constrains unreliable LLM output before it crosses the API boundary.
- Guarantees that every post appears once per graph and that no node links an invented source.
- Keeps every graph focused on its main idea, however deep or scattered the LLM output is.
- Keeps a single embedding model (Ollama) and avoids an unused ONNX dependency plus noisy
  `DefaultEmbeddingFunction` warnings in the API logs.
- Makes long ingestion runs observable feed by feed without polluting the domain event stream.

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

  const [mainMatch] = matches;
  if (!mainMatch) {
    return { summary: NO_CONTEXT_SUMMARY, graph: EMPTY_GRAPH };
  }

  try {
    const generated = await this.graphGenerator.generate(query, matches);
    const retrievedSourceUrls = new Set(matches.map((match) => match.chunk.metadata.articleUrl));
    const sourced = assignUniqueSources(generated.graph, retrievedSourceUrls);
    const centred = {
      ...sourced,
      centralNodeId: resolveCentralNodeId(sourced, mainMatch.chunk.metadata.articleUrl),
    };
    return this.toResponse({
      summary: generated.summary,
      graph: limitGraphDepth(centred, MAX_GRAPH_DEPTH),
    });
  } catch {
    return { summary: GENERATION_FAILURE_SUMMARY, graph: EMPTY_GRAPH };
  }
}
```

### ❌ Bad: Trusting the LLM to keep sources unique and grounded

```typescript
// Two nodes may link the same post, or a node may link a URL that was never retrieved.
return this.toResponse(await this.graphGenerator.generate(query, matches));
```

### ❌ Bad: Trusting the LLM to keep the graph close to its main idea

```typescript
// The prompt asks for at most 3 levels, but nothing guarantees it: nodes may be
// 5 hops away from the central node, or not connected to it at all.
return this.toResponse({ summary: generated.summary, graph: generated.graph });
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

### ✅ Good: Resolve Chroma collections with the precomputed-embeddings guard

```typescript
this.client.getOrCreateCollection({
  name: this.collectionName,
  embeddingFunction: new PrecomputedEmbeddingFunction(),
});
```

### ❌ Bad: Letting Chroma fall back to its default embedding function

```typescript
// Tries to load @chroma-core/default-embed, logs a warning and stores a misleading
// "default" embedding function in the collection configuration.
this.client.getOrCreateCollection({ name: this.collectionName });
```

### ✅ Good: Report feed progress through a port

```typescript
this.progress.feedStarted(feedProgress);
// [1/2] Netflix Tech Blog (https://netflixtechblog.com/feed): in progress
this.progress.feedCompleted(feedProgress, { articles, chunks });
// [1/2] Netflix Tech Blog: completed (15 articles, 140 chunks)
```

### ❌ Bad: Modelling progress as domain events

```typescript
// Progress is not a state change: it floods the event stream with telemetry.
await this.eventBus.publish([new KnowledgeFeedIngestionStarted(feedUrl, position, total)]);
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
- Unique, grounded node sources: `assignUniqueSources` in `apps/api/src/knowledge/domain/knowledge-graph.ts`
- Central node and 3-level depth limit: `resolveCentralNodeId` and `limitGraphDepth` in `apps/api/src/knowledge/domain/knowledge-graph-focus.ts`
- Structured Ollama adapter and JSON validation: `apps/api/src/knowledge/infrastructure/ollama/ollama-structured-graph-generator.ts`
- Port bindings and explicit reader factories: `apps/api/src/knowledge/infrastructure/knowledge.module.ts`
- Chroma collection guard: `apps/api/src/knowledge/infrastructure/chroma/precomputed-embedding-function.ts` and `apps/api/src/knowledge/infrastructure/chroma/chroma-collection.provider.ts`
- Feed progress port and logger adapter: `apps/api/src/knowledge/domain/ingestion-progress-reporter.ts` and `apps/api/src/knowledge/infrastructure/logging/logger-ingestion-progress-reporter.ts`
- Shared HTTP contract: `packages/contracts/src/index.ts`

## Related agreements

- [Hexagonal Architecture](../backend/hexagonal-architecture.md)
- [CQRS and Domain Events](../backend/cqrs-and-domain-events.md)
- [Dependency Injection](../backend/dependency-injection.md)
- [Shared Contracts](../monorepo/shared-contracts.md)
- [RAG Operations and Verification](operations-and-verification.md)

The local pipeline stays traceable from feed to graph thanks to 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
