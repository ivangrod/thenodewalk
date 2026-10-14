/** Upper bound, in characters, of the passage shown for a retrieved source. */
export const SOURCE_EXCERPT_MAX_LENGTH = 320;

const ELLIPSIS = '…';
/** Query words shorter than this carry no meaning for matching ("a", "is", "de"). */
const MIN_TERM_LENGTH = 3;
/** Inflected forms only match when they share a stem at least this long. */
const MIN_STEM_LENGTH = 4;
/** Longest ending allowed after the shared stem ("test" → "tests", "testing"). */
const MAX_SUFFIX_LENGTH = 4;

/** Function words of the questions (English and Spanish) that do not identify a passage. */
const STOPWORDS = new Set([
  'about',
  'and',
  'are',
  'but',
  'can',
  'could',
  'did',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'into',
  'its',
  'not',
  'our',
  'should',
  'that',
  'the',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'those',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'como',
  'con',
  'cual',
  'cuales',
  'cuando',
  'del',
  'donde',
  'entre',
  'esa',
  'ese',
  'eso',
  'esta',
  'este',
  'esto',
  'estos',
  'estas',
  'hay',
  'hacer',
  'las',
  'los',
  'mas',
  'para',
  'pero',
  'por',
  'puede',
  'puedo',
  'que',
  'quien',
  'quienes',
  'sin',
  'sobre',
  'son',
  'ser',
  'sus',
  'una',
  'uno',
  'unos',
  'unas',
]);

const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
/** Sentence ends followed by a new sentence opening; avoids splitting "e.g. it". */
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"'“¿¡(])/u;

/**
 * Selects a short, verbatim passage of an indexed text that best matches a
 * question. The text is already the chunk retrieved by semantic similarity; this
 * pure function only narrows it to the sentence sharing most question terms,
 * extended with the following sentences while it fits in `maxLength`. A sentence
 * longer than `maxLength` is cut around its first matching word with ellipses.
 * Without any shared term (for example, a question in another language) the
 * opening of the text is used. Returns `null` for a blank text. The excerpt is
 * never generated: it is always taken from the indexed text.
 */
export function selectExcerpt(
  text: string,
  query: string,
  maxLength: number = SOURCE_EXCERPT_MAX_LENGTH,
): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized === '') return null;

  const terms = queryTerms(query);
  const sentences = normalized.split(SENTENCE_BOUNDARY);
  let bestIndex = 0;
  let bestScore = 0;
  for (const [index, sentence] of sentences.entries()) {
    const score = matchedTerms(sentence, terms);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  const best = sentences[bestIndex] ?? normalized;
  if (best.length > maxLength) return windowAround(best, terms, maxLength);

  let excerpt = best;
  for (const next of sentences.slice(bestIndex + 1)) {
    const extended = `${excerpt} ${next}`;
    if (extended.length > maxLength) break;
    excerpt = extended;
  }
  return excerpt;
}

function queryTerms(query: string): string[] {
  const terms = words(query).filter(
    (word) => word.length >= MIN_TERM_LENGTH && !STOPWORDS.has(word),
  );
  return [...new Set(terms)];
}

/** Lower-cased, accent-free words without possessive endings. */
function words(text: string): string[] {
  return (text.match(WORD_PATTERN) ?? []).map(normalizeWord);
}

function normalizeWord(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]s$/, '')
    .replace(/['’-]+$/, '');
}

/**
 * Lightweight stemming: two words match when they share a stem of at least
 * {@link MIN_STEM_LENGTH} characters and neither adds more than
 * {@link MAX_SUFFIX_LENGTH} after it ("tests" ~ "testing", but not "test" ~ "testament").
 */
function isMatch(word: string, term: string): boolean {
  if (word === term) return true;
  let stem = 0;
  while (stem < word.length && stem < term.length && word[stem] === term[stem]) stem += 1;
  return (
    stem >= MIN_STEM_LENGTH &&
    word.length - stem <= MAX_SUFFIX_LENGTH &&
    term.length - stem <= MAX_SUFFIX_LENGTH
  );
}

function matchedTerms(sentence: string, terms: string[]): number {
  const sentenceWords = words(sentence);
  return terms.filter((term) => sentenceWords.some((word) => isMatch(word, term))).length;
}

/**
 * Cuts an overlong sentence at word boundaries, keeping about a third of the
 * budget as context before its first matching word.
 */
function windowAround(sentence: string, terms: string[], maxLength: number): string {
  const tokens = sentence.split(' ');
  const firstMatch = tokens.findIndex((token) =>
    words(token).some((word) => terms.some((term) => isMatch(word, term))),
  );
  const anchor = Math.max(0, firstMatch);
  const budget = Math.max(1, maxLength - 2 * ELLIPSIS.length);

  let start = anchor;
  let length = tokens[anchor]?.length ?? 0;
  while (start > 0 && length + 1 + (tokens[start - 1]?.length ?? 0) <= budget / 3) {
    start -= 1;
    length += 1 + (tokens[start]?.length ?? 0);
  }
  let end = anchor + 1;
  while (end < tokens.length && length + 1 + (tokens[end]?.length ?? 0) <= budget) {
    length += 1 + (tokens[end]?.length ?? 0);
    end += 1;
  }

  const body = tokens.slice(start, end).join(' ').slice(0, budget);
  return `${start > 0 ? ELLIPSIS : ''}${body}${end < tokens.length ? ELLIPSIS : ''}`;
}
