import { knowledgeChunkId } from './knowledge-chunk';
import { BookChunkMother } from './testing/book.mother';
import { KnowledgeChunkMother } from './testing/knowledge.mother';

describe('knowledge chunk identities', () => {
  it('keeps post ids derived from articleUrl and chunkIndex', () => {
    expect(
      KnowledgeChunkMother.create({ articleUrl: 'https://blog.test/post', chunkIndex: 2 }).id,
    ).toBe(knowledgeChunkId('https://blog.test/post', 2));
  });
  it('derives book ids from bookId, sectionIndex and chunkIndex, independent of path', () => {
    const first = BookChunkMother.create({ bookId: 'hash', sectionIndex: 3, chunkIndex: 2 });
    const renamed = BookChunkMother.create({
      bookId: 'hash',
      sectionIndex: 3,
      chunkIndex: 2,
      filePath: '/renamed.epub',
    });
    expect(first.id).toBe(knowledgeChunkId('hash#3', 2));
    expect(renamed.id).toBe(first.id);
    expect(BookChunkMother.create({ bookId: 'hash', sectionIndex: 4, chunkIndex: 2 }).id).not.toBe(
      first.id,
    );
  });
});
