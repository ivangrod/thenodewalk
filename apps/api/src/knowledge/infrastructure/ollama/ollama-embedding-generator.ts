import { Ollama } from 'ollama';

import type { EmbeddingGenerator } from '../../domain/embedding-generator';

/**
 * Subset of the Ollama client used to generate embeddings. Keeping it local lets
 * the adapter be unit tested and the real client be injected in production.
 */
export interface OllamaEmbedClient {
  embed(request: {
    model: string;
    input: string[];
    truncate: boolean;
  }): Promise<{ embeddings: number[][] }>;
}

/**
 * Task instructions a retrieval model was trained with. They are prepended to the
 * text before embedding it; without them, asymmetric models lose most of their
 * retrieval quality.
 */
export interface EmbeddingTaskPrefixes {
  document: string;
  query: string;
}

const NO_TASK_PREFIXES: EmbeddingTaskPrefixes = { document: '', query: '' };
export const OLLAMA_EMBED_BATCH_SIZE = 32;

/** Known retrieval models by Ollama name, without the `:tag` suffix. */
const TASK_PREFIXES_BY_MODEL: ReadonlyMap<string, EmbeddingTaskPrefixes> = new Map([
  ['nomic-embed-text', { document: 'search_document: ', query: 'search_query: ' }],
  [
    'mxbai-embed-large',
    { document: '', query: 'Represent this sentence for searching relevant passages: ' },
  ],
]);

/**
 * Resolves the task prefixes of an Ollama embedding model such as
 * `nomic-embed-text` or `nomic-embed-text:latest`. Unknown models get none.
 */
export function embeddingTaskPrefixesFor(model: string): EmbeddingTaskPrefixes {
  const [name = ''] = model.trim().toLowerCase().split(':');
  return TASK_PREFIXES_BY_MODEL.get(name) ?? NO_TASK_PREFIXES;
}

/**
 * Generates embeddings through a locally running Ollama model
 * (default `nomic-embed-text`).
 *
 * It uses `/api/embed`, which returns L2-normalized vectors, rather than the
 * deprecated `/api/embeddings`, whose vectors keep an arbitrary norm. Documents
 * and queries get the task prefixes of the model, and texts longer than its
 * context window are truncated instead of failing the whole batch.
 */
export class OllamaEmbeddingGenerator implements EmbeddingGenerator {
  constructor(
    private readonly client: OllamaEmbedClient,
    private readonly model: string,
    private readonly prefixes: EmbeddingTaskPrefixes = embeddingTaskPrefixesFor(model),
  ) {}

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (documents.length === 0) {
      return [];
    }
    const embeddings: number[][] = [];
    for (let start = 0; start < documents.length; start += OLLAMA_EMBED_BATCH_SIZE) {
      embeddings.push(
        ...(await this.embed(
          documents
            .slice(start, start + OLLAMA_EMBED_BATCH_SIZE)
            .map((document) => `${this.prefixes.document}${document}`),
        )),
      );
    }
    return embeddings;
  }

  async embedQuery(query: string): Promise<number[]> {
    const [embedding] = await this.embed([`${this.prefixes.query}${query}`]);
    if (embedding === undefined) {
      throw new Error(`Ollama returned no embedding for the query with model ${this.model}`);
    }
    return embedding;
  }

  private async embed(input: string[]): Promise<number[][]> {
    const { embeddings } = await this.client.embed({ model: this.model, input, truncate: true });
    if (embeddings.length !== input.length) {
      throw new Error(
        `Ollama returned ${embeddings.length} embeddings for ${input.length} texts with model ${this.model}`,
      );
    }
    return embeddings;
  }
}

/**
 * Builds a production {@link OllamaEmbeddingGenerator} from environment settings.
 */
export function createOllamaEmbeddingGenerator(
  url: string,
  model: string,
): OllamaEmbeddingGenerator {
  return new OllamaEmbeddingGenerator(new Ollama({ host: url }), model);
}
