import { selectExcerpt, SOURCE_EXCERPT_MAX_LENGTH } from './source-excerpt';

const TEXT =
  'Teams ship in small batches. Small feedback loops make engineering changes easier to review. ' +
  'Continuous integration keeps the main branch releasable. Pair programming spreads knowledge.';

describe('selectExcerpt', () => {
  it('starts at the sentence sharing most question terms and keeps the following context', () => {
    expect(selectExcerpt(TEXT, 'How do feedback loops help code review?', 140)).toBe(
      'Small feedback loops make engineering changes easier to review. Continuous integration keeps the main branch releasable.',
    );
  });

  it('matches inflected forms, case and accents while ignoring stopwords', () => {
    const text = 'Intro text here. Refactoring legacy code needs tests. Another sentence follows.';
    expect(selectExcerpt(text, 'WHAT is the best way to REFACTOR with testing?', 70)).toBe(
      'Refactoring legacy code needs tests. Another sentence follows.',
    );
    expect(
      selectExcerpt('Otro texto. La configuración del despliegue importa.', '¿Cómo configuracion?'),
    ).toBe('La configuración del despliegue importa.');
  });

  it('does not treat unrelated words sharing a short prefix as matches', () => {
    const text = 'The old testament is long. Unit tests document behaviour.';
    expect(selectExcerpt(text, 'test', 30)).toBe('Unit tests document behaviour.');
  });

  it('falls back to the opening of the text when no question term appears', () => {
    expect(selectExcerpt(TEXT, '¿Qué opinas?', 60)).toBe('Teams ship in small batches.');
  });

  it('cuts an overlong sentence around its first match with ellipses at word boundaries', () => {
    const filler = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const text = `${filler} observability matters for distributed systems ${filler}`;
    const excerpt = selectExcerpt(text, 'observability', 120);
    expect(excerpt).not.toBeNull();
    expect(excerpt!.length).toBeLessThanOrEqual(120);
    expect(excerpt!.startsWith('…')).toBe(true);
    expect(excerpt!.endsWith('…')).toBe(true);
    expect(excerpt).toContain('observability matters');
    const originalTokens = new Set(text.split(' '));
    const excerptTokens = excerpt!.replace(/^…|…$/g, '').split(' ');
    expect(excerptTokens.every((token) => originalTokens.has(token))).toBe(true);
  });

  it('never exceeds the default length and normalizes whitespace', () => {
    const long = Array.from({ length: 200 }, () => 'Sentence about caching.').join('\n\n');
    const excerpt = selectExcerpt(long, 'caching');
    expect(excerpt!.length).toBeLessThanOrEqual(SOURCE_EXCERPT_MAX_LENGTH);
    expect(excerpt).not.toMatch(/\s{2,}|\n/);
  });

  it('returns null for blank text', () => {
    expect(selectExcerpt('   \n ', 'anything')).toBeNull();
  });
});
