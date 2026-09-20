import { ChromaClient, type Metadata } from 'chromadb';

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
    include: ('documents' | 'metadatas' | 'embeddings' | 'distances')[];
  }): Promise<{
    ids: string[][];
    documents: (string | null)[][];
    embeddings: (number[] | null)[][] | null;
    metadatas: (Metadata | null)[][];
  }>;
}

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
 * The collection handle is created once and reused across calls.
 */
export class ChromaClientCollectionProvider implements ChromaCollectionProvider {
  private collectionPromise?: Promise<ChromaCollectionGateway>;

  constructor(
    private readonly client: ChromaClient,
    private readonly collectionName: string,
  ) {}

  collection(): Promise<ChromaCollectionGateway> {
    this.collectionPromise ??= this.client
      .getOrCreateCollection({ name: this.collectionName })
      .then((collection) => ({
        upsert: (params) => collection.upsert(params),
        query: (params) => collection.query(params),
      }));

    return this.collectionPromise;
  }
}
