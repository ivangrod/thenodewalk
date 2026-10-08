import type { KnowledgeSearchMatch } from './knowledge-chunk-repository';

/** Selects distinct sources by relevance, reserving slots for both available corpora. */
export function selectBalancedMatches(
  bookMatches: KnowledgeSearchMatch[],
  postMatches: KnowledgeSearchMatch[],
  options: { total: number; bookShare: number },
): KnowledgeSearchMatch[] {
  const { total, bookShare } = options;
  if (
    !Number.isInteger(total) ||
    total < 0 ||
    !Number.isFinite(bookShare) ||
    bookShare < 0 ||
    bookShare > 1
  ) {
    throw new Error('Expected a non-negative integer total and bookShare between 0 and 1');
  }
  if (total === 0) return [];
  const books = distinctSources(bookMatches);
  const posts = distinctSources(postMatches);
  if (total === 1) return [...books, ...posts].sort(byScore).slice(0, 1);
  const bookSlots = Math.min(total - 1, Math.max(1, Math.round(total * bookShare)));
  const selected = [...books.slice(0, bookSlots), ...posts.slice(0, total - bookSlots)];
  const selectedIds = new Set(selected.map(({ chunk }) => chunk.metadata.sourceId));
  const remaining = [...books, ...posts]
    .filter(({ chunk }) => !selectedIds.has(chunk.metadata.sourceId))
    .sort(byScore);
  return [...selected, ...remaining.slice(0, total - selected.length)].sort(byScore);
}

function distinctSources(matches: KnowledgeSearchMatch[]): KnowledgeSearchMatch[] {
  const best = new Map<string, KnowledgeSearchMatch>();
  for (const match of matches) {
    const sourceId = match.chunk.metadata.sourceId;
    const previous = best.get(sourceId);
    if (!previous || match.score > previous.score) best.set(sourceId, match);
  }
  return [...best.values()].sort(byScore);
}

function byScore(left: KnowledgeSearchMatch, right: KnowledgeSearchMatch): number {
  return right.score - left.score;
}
