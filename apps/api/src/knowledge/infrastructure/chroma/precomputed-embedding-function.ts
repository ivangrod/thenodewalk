import type { EmbeddingFunction } from 'chromadb';

/**
 * Chroma embedding function for collections that only store precomputed vectors.
 *
 * Embeddings are always produced through the `EmbeddingGenerator` port (Ollama),
 * so Chroma must never embed raw text itself. Passing this function explicitly
 * also stops the SDK from falling back to `@chroma-core/default-embed`.
 */
export class PrecomputedEmbeddingFunction implements EmbeddingFunction {
  readonly name = 'precomputed';

  generate(): Promise<number[][]> {
    return Promise.reject(
      new Error(
        'This Chroma collection only accepts precomputed embeddings generated through the EmbeddingGenerator port.',
      ),
    );
  }
}
