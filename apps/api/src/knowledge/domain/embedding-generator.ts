/**
 * Port for turning text into an embedding vector.
 */
export interface EmbeddingGenerator {
  generate(text: string): Promise<number[]>;
}
