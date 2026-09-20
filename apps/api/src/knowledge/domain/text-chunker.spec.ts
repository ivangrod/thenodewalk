import { chunkText, DEFAULT_CHUNKING_OPTIONS } from './text-chunker';

describe('chunkText', () => {
  it('returns no chunks for blank text', () => {
    expect(chunkText('   \n  ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    expect(chunkText('a small paragraph of text')).toEqual(['a small paragraph of text']);
  });

  it('splits long text into overlapping word windows', () => {
    const words = Array.from({ length: 800 }, (_, index) => `word${index}`);
    const chunks = chunkText(words.join(' '));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.split(' ')).toHaveLength(DEFAULT_CHUNKING_OPTIONS.maxWords);
  });

  it('overlaps consecutive chunks by the configured amount', () => {
    const words = Array.from({ length: 20 }, (_, index) => `word${index}`);
    const chunks = chunkText(words.join(' '), { maxWords: 10, overlapWords: 4 });

    const firstChunkWords = chunks[0]?.split(' ') ?? [];
    const secondChunkWords = chunks[1]?.split(' ') ?? [];
    // step = maxWords - overlap = 6, so the second chunk starts at word6.
    expect(secondChunkWords[0]).toBe('word6');
    expect(firstChunkWords).toContain('word6');
  });
});
