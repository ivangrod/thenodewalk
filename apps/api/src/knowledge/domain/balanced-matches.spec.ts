import { selectBalancedMatches } from './balanced-matches';
import type { KnowledgeSearchMatch } from './knowledge-chunk-repository';
import { BookChunkMother } from './testing/book.mother';
import { KnowledgeChunkMother } from './testing/knowledge.mother';

const OPTIONS = { total: 5, bookShare: 0.65 };

function matches(kind: 'book' | 'post', count: number): KnowledgeSearchMatch[] {
  return Array.from({ length: count }, (_, index) => ({
    chunk:
      kind === 'book'
        ? BookChunkMother.create({ bookId: `book-${index}` })
        : KnowledgeChunkMother.create({ articleUrl: `https://post.test/${index}` }),
    score: 1 - index * 0.1,
  }));
}

describe('selectBalancedMatches', () => {
  it('selects three books and two posts and orders the selected sources by score', () => {
    const books = matches('book', 5);
    const posts = matches('post', 5);
    const result = selectBalancedMatches(books, posts, OPTIONS);
    expect(result.filter(({ chunk }) => chunk.metadata.sourceType === 'book')).toHaveLength(3);
    expect(result.filter(({ chunk }) => chunk.metadata.sourceType === 'post')).toHaveLength(2);
    expect(result.map(({ score }) => score)).toEqual([1, 1, 0.9, 0.9, 0.8]);
  });

  it.each([0, 1])(
    'reserves at least one slot for each available type even at share %s',
    (bookShare) => {
      const result = selectBalancedMatches(matches('book', 5), matches('post', 5), {
        total: 5,
        bookShare,
      });
      expect(new Set(result.map(({ chunk }) => chunk.metadata.sourceType)).size).toBe(2);
    },
  );

  it.each(['book', 'post'] as const)('fills missing %s slots with the other corpus', (missing) => {
    const result = selectBalancedMatches(
      matches('book', missing === 'book' ? 1 : 6),
      matches('post', missing === 'post' ? 1 : 6),
      OPTIONS,
    );
    expect(result).toHaveLength(5);
    expect(result.filter(({ chunk }) => chunk.metadata.sourceType === missing)).toHaveLength(1);
  });

  it.each(['book', 'post'] as const)(
    'returns up to five %s sources when the other corpus is empty',
    (kind) => {
      const result = selectBalancedMatches(
        kind === 'book' ? matches(kind, 6) : [],
        kind === 'post' ? matches(kind, 6) : [],
        OPTIONS,
      );
      expect(result).toHaveLength(5);
      expect(result.every(({ chunk }) => chunk.metadata.sourceType === kind)).toBe(true);
    },
  );

  it('keeps the best chunk per source before allocating slots, without mutating inputs', () => {
    const books = matches('book', 3);
    const duplicate = {
      chunk: BookChunkMother.create({ bookId: 'book-0', chunkIndex: 1 }),
      score: 0.99,
    };
    const best = { ...duplicate, score: 1.1 };
    const input = [duplicate, ...books, best];
    const original = [...input];
    const result = selectBalancedMatches(input, matches('post', 2), OPTIONS);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(best);
    expect(new Set(result.map(({ chunk }) => chunk.metadata.sourceId)).size).toBe(5);
    expect(input).toEqual(original);
  });

  it('counts distinct sections of the same book as separate sources', () => {
    const books = [0, 1, 2].map((sectionIndex) => ({
      chunk: BookChunkMother.create({ bookId: 'same-book', sectionIndex }),
      score: 0.9,
    }));
    expect(selectBalancedMatches(books, matches('post', 2), OPTIONS)).toHaveLength(5);
  });

  it('returns fewer results when there are not enough distinct sources and none when empty', () => {
    expect(selectBalancedMatches(matches('book', 1), matches('post', 1), OPTIONS)).toHaveLength(2);
    expect(selectBalancedMatches([], [], OPTIONS)).toEqual([]);
  });

  it('handles zero/one slot and rejects invalid configuration', () => {
    const books = matches('book', 2);
    const posts = matches('post', 2);
    expect(selectBalancedMatches(books, posts, { ...OPTIONS, total: 0 })).toEqual([]);
    expect(selectBalancedMatches(books, posts, { ...OPTIONS, total: 1 })).toHaveLength(1);
    expect(() => selectBalancedMatches(books, posts, { ...OPTIONS, total: -1 })).toThrow();
    expect(() => selectBalancedMatches(books, posts, { ...OPTIONS, bookShare: NaN })).toThrow();
  });
});
