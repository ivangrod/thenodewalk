import { Ollama } from 'ollama';

import type { EmbeddingGenerator } from '../../domain/embedding-generator';

/**
 * Subset of the Ollama client used to generate embeddings. Keeping it local lets
 * the adapter be unit tested and the real client be injected in production.
 */
export interface OllamaEmbeddingsClient {
  embeddings(request: { model: string; prompt: string }): Promise<{ embedding: number[] }>;
}

/**
 * Generates embeddings through a locally running Ollama model
 * (default `nomic-embed-text`).
 */
export class OllamaEmbeddingGenerator implements EmbeddingGenerator {
  constructor(
    private readonly client: OllamaEmbeddingsClient,
    private readonly model: string,
  ) {}

  async generate(text: string): Promise<number[]> {
    const response = await this.client.embeddings({ model: this.model, prompt: text });
    return response.embedding;
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
