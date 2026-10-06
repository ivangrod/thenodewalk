# TechGraph RAG Local Pipeline

## Convention

The TechGraph RAG pipeline lives in the `knowledge` context in `apps/api` and stays
fully local:

1. `IngestFeedsCommand` is a Command. It reads OPML subscriptions, fetches RSS entries,
   loads publication dates from PostgreSQL once into a `Map` keyed by `blogName`, then
   parses each RSS date once. A pure selector deduplicates URLs, sorts newest first and
   stops at the stored timestamp. Only strictly newer posts reach Readability and Ollama.
   Undated/invalid dates are always processed without advancing the cursor; the RSS
   adapter must never invent a publication date. Chunks are upserted feed by feed,
   keeping memory bounded to one feed.
2. Chunk identifiers must be deterministic (`sha256(articleUrl#chunkIndex)`) so a repeat
   ingestion updates the existing vector rather than creating duplicates. Because the id
   derives from the article URL, an article must be ingested at most once per run: ChromaDB
   rejects an upsert that repeats an id. `IngestFeedsCommand` ingests only the first
   subscription of a feed URL repeated in the OPML, and skips an article already ingested
   through another feed (cross-posts) or listed twice in the same feed. Article URLs are only
   marked as ingested once their feed succeeds, so a feed that fails halfway does not hide its
   articles from later feeds.
3. Ingestion publishes `KnowledgeIngestionCompleted` for every completed run and
   one `KnowledgeFeedIngested` after each successful feed with a known indexed date.
   Its in-memory subscriber invokes `SaveLastPublicationDateCommand`, which saves the
   cursor through a repository port and emits `FeedLastPublicationDateSaved`.
   Subscribers are awaited before CLI shutdown; failures are logged without losing
   already indexed chunks. The Prisma adapter atomically preserves the greatest date.
   `--full` bypasses the initial snapshot to recover vectors after ChromaDB data loss.
   Ambiguous blog names (distinct feed URLs with one name) bypass and do not save cursors.
   An unchanged feed is successful, not empty. Ingestion also publishes
   `KnowledgeIngestionFailed` for an individual feed failure. A problem with a feed must never
   stop the remaining subscriptions: an `inaccessible` feed (fetching or reading it throws), an
   `empty` feed (read without error but yielding zero chunks, because the RSS has no entries
   or none of its articles had extractable text), and a `duplicate` feed (its URL is already
   declared earlier in the OPML) are all collected into `IngestionResult.issues` instead, so
   the run ends with a full summary. A feed whose articles were all ingested through an
   earlier feed is not `empty`: its content is indexed.
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
   produced exclusively through the `EmbeddingGenerator` port. The Chroma adapter splits
   upserts into batches of `CHROMA_UPSERT_BATCH_SIZE` (500), below the server's
   `max_batch_size` (5461, see `GET /api/v2/pre-flight-checks`), because a full OPML run
   produces far more chunks than a single request accepts.
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
12. Every generation request sends its own bounded context window (`num_ctx`, default 8192
    tokens) and `keep_alive` (default `30m`), configurable with `OLLAMA_LLM_CONTEXT_LENGTH` and
    `OLLAMA_LLM_KEEP_ALIVE`. The API must not depend on the global Ollama "Context length"
    setting: a 128k window makes `llama3.1:8b` reserve a 16 GiB KV cache and freezes the host.
    Invalid values fail when the API boots.

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
- Surfaces every unreachable or contentless feed in one place at the end of a run, instead of
  requiring someone to scroll back through per-feed log lines to notice a silent gap.
- Keeps memory use and latency of `/ask` predictable on any machine and avoids reloading the
  model between consecutive queries.

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

### ✅ Good: Bounded context window and keep-alive on every generation request

```typescript
await this.client.chat({
  model: this.model,
  format: 'json',
  keep_alive: this.settings.keepAlive, // '30m'
  options: { temperature: 0, num_ctx: this.settings.contextLength }, // 8192
  messages,
});
```

### ❌ Bad: Inheriting the context window from the global Ollama configuration

```typescript
// With "Context length" set to 256k in the Ollama app, llama3.1:8b loads a 128k window,
// reserves a 16 GiB KV cache and unloads again after 5 idle minutes.
await this.client.chat({
  model: this.model,
  format: 'json',
  options: { temperature: 0 },
  messages,
});
```

### ✅ Good: Isolating a broken or contentless feed into the run's issue summary

```typescript
try {
  const feedChunks = await this.ingestSubscription(subscription, ingestedArticleUrls);
  chunks.push(...feedChunks.chunks);
  if (feedChunks.chunks.length === 0 && feedChunks.alreadyIngestedArticles === 0) {
    issues.push({
      blogName,
      feedUrl,
      type: 'empty',
      reason: this.emptyFeedReason(feedChunks.articleCount),
    });
  }
} catch (error) {
  issues.push({ blogName, feedUrl, type: 'inaccessible', reason: this.toReason(error) });
  await this.eventBus.publish([new KnowledgeIngestionFailed(feedUrl, reason, now)]);
}
// The loop always continues; `issues` is returned once every subscription has been tried.
return { processedFeeds, processedArticles, indexedChunks: chunks.length, issues };
```

### ❌ Bad: Letting a broken or contentless feed go unnoticed

```typescript
// Either throws and stops the whole OPML run, or silently reports "completed
// (0 articles, 0 chunks)" with nothing to tell the caller a feed needs attention.
const feedChunks = await this.ingestSubscription(subscription);
chunks.push(...feedChunks.chunks);
```

### ✅ Good: Ingesting every article once per run and upserting in bounded batches

```typescript
// Command: a repeated feed URL becomes a `duplicate` issue, a seen article is skipped.
if (ingestedArticleUrls.has(article.url)) {
  alreadyIngestedArticles += 1;
  continue;
}

// Chroma adapter: never send more than CHROMA_UPSERT_BATCH_SIZE records per request.
for (let start = 0; start < chunks.length; start += this.batchSize) {
  await collection.upsert(this.toPayload(chunks.slice(start, start + this.batchSize)));
}
```

### ❌ Bad: Accumulating every chunk of the run and upserting them at once

```typescript
// "Facebook" and "Facebook AI Research" share https://engineering.fb.com/feed/, so the same
// article yields the same sha256(articleUrl#chunkIndex) twice:
//   ChromaValueError: Expected IDs to be unique, but found duplicates of ...
// Even without duplicates, a full OPML run exceeds max_batch_size (5461) in one request.
await collection.upsert({ ids: allRunChunks.map((chunk) => chunk.id) /* ... */ });
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
- Inaccessible and empty feed issues: `FeedIngestionIssue` and `IngestionResult.issues` in
  `apps/api/src/knowledge/application/ingest-feeds.command.ts`, printed by
  `apps/api/src/knowledge/infrastructure/cli/ingest.ts`
- Read-only RAG Query: `apps/api/src/knowledge/application/answer-technical-query.query.ts`
- Deterministic chunks and repository port: `apps/api/src/knowledge/domain/knowledge-chunk.ts` and `apps/api/src/knowledge/domain/knowledge-chunk-repository.ts`
- Unique, grounded node sources: `assignUniqueSources` in `apps/api/src/knowledge/domain/knowledge-graph.ts`
- Central node and 3-level depth limit: `resolveCentralNodeId` and `limitGraphDepth` in `apps/api/src/knowledge/domain/knowledge-graph-focus.ts`
- Structured Ollama adapter and JSON validation: `apps/api/src/knowledge/infrastructure/ollama/ollama-structured-graph-generator.ts`
- Port bindings and explicit reader factories: `apps/api/src/knowledge/infrastructure/knowledge.module.ts`
- Chroma collection guard: `apps/api/src/knowledge/infrastructure/chroma/precomputed-embedding-function.ts` and `apps/api/src/knowledge/infrastructure/chroma/chroma-collection.provider.ts`
- Batched Chroma upserts: `CHROMA_UPSERT_BATCH_SIZE` in `apps/api/src/knowledge/infrastructure/chroma/chroma-knowledge-chunk.repository.ts`
- Duplicate feeds and articles per run: `splitDuplicateSubscriptions` and `ingestSubscription` in `apps/api/src/knowledge/application/ingest-feeds.command.ts`
- Feed progress port and logger adapter: `apps/api/src/knowledge/domain/ingestion-progress-reporter.ts` and `apps/api/src/knowledge/infrastructure/logging/logger-ingestion-progress-reporter.ts`
- Shared HTTP contract: `packages/contracts/src/index.ts`

## Related agreements

- [Hexagonal Architecture](../backend/hexagonal-architecture.md)
- [CQRS and Domain Events](../backend/cqrs-and-domain-events.md)
- [Dependency Injection](../backend/dependency-injection.md)
- [Shared Contracts](../monorepo/shared-contracts.md)
- [RAG Operations and Verification](operations-and-verification.md)

The local pipeline stays traceable from feed to graph thanks to 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
