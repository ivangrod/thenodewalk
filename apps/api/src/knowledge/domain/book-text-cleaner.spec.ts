import { cleanBookText } from './book-text-cleaner';

describe('cleanBookText', () => {
  it('removes repeated headers and footers with varying page numbers', () => {
    const pages = ['First', 'Second', 'Third'].map(
      (word, index) =>
        `${index + 1} | Engineering\n${word} paragraph\nMore ${word} content\nEngineering Press ${index + 1}`,
    );
    expect(cleanBookText(pages)).toEqual([
      'First paragraph\nMore First content',
      'Second paragraph\nMore Second content',
      'Third paragraph\nMore Third content',
    ]);
  });

  it('removes standalone page numbers and dotted TOC lines', () => {
    expect(cleanBookText(['12\nFeedback loops ......... 42\nUseful content\nxiv'])).toEqual([
      'Useful content',
    ]);
  });

  it('joins line-hyphenated words but preserves uppercase compound words', () => {
    expect(cleanBookText(['develop-\nment and Test-\nDriven\nwell-known examples'])).toEqual([
      'development and Test-Driven\nwell-known examples',
    ]);
  });

  it('normalizes ligatures and leaves blank page positions empty', () => {
    expect(cleanBookText(['eﬀective ﬁrst steps', ' \n ', 'Final page'])).toEqual([
      'effective first steps',
      '',
      'Final page',
    ]);
  });

  it('preserves interior repetitions and short documents without reliable running headers', () => {
    expect(cleanBookText(['Repeated\nbody', 'Repeated\nother'])).toEqual([
      'Repeated\nbody',
      'Repeated\nother',
    ]);
    const pages = ['One', 'Two', 'Three'].map(
      (word) => `${word} heading\n${word} text\nRepeated interior\n${word} ending\n${word} footer`,
    );
    expect(cleanBookText(pages)).toEqual(pages);
  });
});
