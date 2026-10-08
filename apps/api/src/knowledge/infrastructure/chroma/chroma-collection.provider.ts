import type { ChromaClient, CollectionConfiguration, Metadata } from 'chromadb';

import { PrecomputedEmbeddingFunction } from './precomputed-embedding-function';

/**
 * Distance used to compare knowledge chunks. Cosine ignores the vector norm, so a
 * vector with an unusual magnitude cannot outrank semantically closer chunks.
 */
export const KNOWLEDGE_CHUNKS_SPACE = 'cosine';

/** Distance ChromaDB applies when a collection does not declare one. */
const CHROMA_DEFAULT_SPACE = 'l2';

/**
 * Raised when the existing collection was created with another distance. ChromaDB
 * cannot change the distance of a collection, and its vectors come from an older
 * embedding scheme, so mixing them with new vectors would silently break retrieval.
 */
export class IncompatibleKnowledgeCollectionError extends Error {
  constructor(collectionName: string, space: string) {
    super(
      `Chroma collection "${collectionName}" uses the "${space}" distance, but knowledge chunks must be compared with "${KNOWLEDGE_CHUNKS_SPACE}". ` +
        'Its vectors come from an older embedding scheme: delete the collection and rebuild it with `pnpm --filter @thenodewalk/api ingest --full`.',
    );
    this.name = 'IncompatibleKnowledgeCollectionError';
  }
}

/**
 * Minimal view of a ChromaDB collection used by the repository. Declaring it
 * locally keeps the adapter easy to unit test without a running server.
 */
export interface ChromaCollectionGateway {
  upsert(params: {
    ids: string[];
    embeddings: number[][];
    documents: string[];
    metadatas: Metadata[];
  }): Promise<void>;
  query(params: {
    queryEmbeddings: number[][];
    nResults: number;
    where?: { sourceType: 'post' | 'book' };
    include: ('documents' | 'metadatas' | 'embeddings' | 'distances')[];
  }): Promise<{
    ids: string[][];
    documents: (string | null)[][];
    embeddings: (number[] | null)[][] | null;
    metadatas: (Metadata | null)[][];
    distances: (number | null)[][] | null;
  }>;
}

/**
 * Injection token of the {@link ChromaCollectionProvider} shared by the repository
 * and the ingestion CLI, which resolves the collection before fetching any feed.
 */
export const CHROMA_COLLECTION_PROVIDER = 'CHROMA_COLLECTION_PROVIDER';

/**
 * Provides the (lazily created) ChromaDB collection the repository operates on.
 */
export interface ChromaCollectionProvider {
  collection(): Promise<ChromaCollectionGateway>;
}

/**
 * Builds {@link ChromaClient} arguments from a `CHROMA_URL` such as
 * `http://localhost:8000`.
 */
export function chromaClientArgsFromUrl(url: string): {
  host: string;
  port: number;
  ssl: boolean;
} {
  const parsed = new URL(url);
  const ssl = parsed.protocol === 'https:';
  return {
    host: parsed.hostname,
    port: parsed.port === '' ? (ssl ? 443 : 80) : Number(parsed.port),
    ssl,
  };
}

/**
 * Production {@link ChromaCollectionProvider} backed by a real ChromaDB client.
 * The collection handle is created once and reused across calls. It is always
 * resolved with a {@link PrecomputedEmbeddingFunction} because embeddings come
 * from the `EmbeddingGenerator` port, never from Chroma's default function.
 * New collections use the {@link KNOWLEDGE_CHUNKS_SPACE} distance, and an existing
 * collection with any other distance is rejected with an
 * {@link IncompatibleKnowledgeCollectionError}.
 */
export class ChromaClientCollectionProvider implements ChromaCollectionProvider {
  private collectionPromise?: Promise<ChromaCollectionGateway>;

  constructor(
    private readonly client: Pick<ChromaClient, 'getOrCreateCollection'>,
    private readonly collectionName: string,
  ) {}

  collection(): Promise<ChromaCollectionGateway> {
    this.collectionPromise ??= this.client
      .getOrCreateCollection({
        name: this.collectionName,
        embeddingFunction: new PrecomputedEmbeddingFunction(),
        configuration: { hnsw: { space: KNOWLEDGE_CHUNKS_SPACE } },
      })
      .then((collection) => {
        const space = this.spaceOf(collection.configuration);
        if (space !== KNOWLEDGE_CHUNKS_SPACE) {
          throw new IncompatibleKnowledgeCollectionError(this.collectionName, space);
        }
        return {
          upsert: (params) => collection.upsert(params),
          query: (params) => collection.query(params),
        };
      });

    return this.collectionPromise;
  }

  /** `getOrCreateCollection` ignores the requested configuration if the collection exists. */
  private spaceOf(configuration: CollectionConfiguration | undefined): string {
    return configuration?.hnsw?.space ?? configuration?.spann?.space ?? CHROMA_DEFAULT_SPACE;
  }
}
