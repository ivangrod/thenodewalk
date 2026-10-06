/**
 * Port for turning text into embedding vectors.
 *
 * Documents and queries go through separate methods because retrieval models
 * encode them asymmetrically (for example, `nomic-embed-text` expects different
 * task prefixes for each). Every vector must be comparable with cosine similarity
 * against the vectors produced by the other method.
 */
export interface EmbeddingGenerator {
  /** Embeds passages that will be stored and retrieved later, in the same order. */
  embedDocuments(documents: string[]): Promise<number[][]>;
  /** Embeds a search question to compare against stored documents. */
  embedQuery(query: string): Promise<number[]>;
}
