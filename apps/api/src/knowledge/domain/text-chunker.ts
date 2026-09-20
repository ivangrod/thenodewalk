export interface ChunkingOptions {
  /** Target chunk size expressed in whitespace-separated words. */
  maxWords: number;
  /** Words shared between consecutive chunks to preserve context. */
  overlapWords: number;
}

/**
 * ~350 words keeps each chunk around 500 tokens for common English prose,
 * matching the ~500-1000 token target of the ingestion pipeline.
 */
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxWords: 350,
  overlapWords: 40,
};

/**
 * Splits cleaned article text into overlapping, semantically-sized chunks.
 * Pure function: deterministic output for a given input and options.
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }

  const maxWords = Math.max(1, options.maxWords);
  const step = Math.max(1, maxWords - Math.max(0, options.overlapWords));
  const chunks: string[] = [];

  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + maxWords).join(' '));
    if (start + maxWords >= words.length) {
      break;
    }
  }

  return chunks;
}
