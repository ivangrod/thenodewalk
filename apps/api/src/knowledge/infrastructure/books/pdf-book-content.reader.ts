import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import { getDocumentProxy } from 'unpdf';

import type {
  BookContent,
  BookContentReader,
  BookFile,
  BookSection,
} from '../../domain/book-content-reader';
import { cleanBookText } from '../../domain/book-text-cleaner';

export const PDF_SECTION_PAGE_COUNT = 10;
type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;
type PdfOutline = NonNullable<Awaited<ReturnType<PdfDocument['getOutline']>>>;
interface SectionStart {
  title: string;
  page: number;
}

export class PdfBookContentReader implements BookContentReader {
  async read(file: BookFile): Promise<BookContent> {
    const bytes = await readFile(file.filePath);
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    try {
      const { info } = await pdf.getMetadata();
      const title =
        'Title' in info && typeof info.Title === 'string' && info.Title.trim()
          ? info.Title.trim()
          : basename(file.filePath, extname(file.filePath));
      const authors =
        'Author' in info && typeof info.Author === 'string' && info.Author.trim()
          ? [info.Author.trim()]
          : [];
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''))
              .join(''),
          );
        } finally {
          page.cleanup();
        }
      }
      const cleaned = cleanBookText(pages);
      const starts = await this.sectionStarts(pdf);
      const sections: BookSection[] = [];
      for (const [index, start] of starts.entries()) {
        const pageEnd = (starts[index + 1]?.page ?? pdf.numPages + 1) - 1;
        if (/^(?:copyright|(?:table of )?contents|index)(?:\s|$)/i.test(start.title.trim()))
          continue;
        const text = cleaned
          .slice(start.page - 1, pageEnd)
          .filter(Boolean)
          .join('\n\n');
        if (!text.trim()) continue;
        sections.push({ index, title: start.title, text, pageStart: start.page, pageEnd });
      }
      return {
        contentHash: createHash('sha256').update(bytes).digest('hex'),
        title,
        authors,
        sections,
      };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }

  private async sectionStarts(pdf: PdfDocument): Promise<SectionStart[]> {
    const starts: SectionStart[] = [];
    const visit = async (outline: PdfOutline): Promise<void> => {
      for (const entry of outline) {
        try {
          const destination =
            typeof entry.dest === 'string' ? await pdf.getDestination(entry.dest) : entry.dest;
          if (Array.isArray(destination) && destination.length > 0) {
            const ref: unknown = destination[0];
            const pageIndex =
              typeof ref === 'number' ? ref : await pdf.getPageIndex(destination[0]);
            if (Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < pdf.numPages) {
              starts.push({
                title: entry.title.trim() || `Page ${pageIndex + 1}`,
                page: pageIndex + 1,
              });
            }
          }
        } catch {
          // Broken/external bookmarks do not prevent extraction; use remaining valid entries.
        }
        await visit(entry.items);
      }
    };
    await visit((await pdf.getOutline()) ?? []);
    const unique = starts
      .sort((a, b) => a.page - b.page)
      .filter((start, index, all) => index === 0 || start.page !== all[index - 1]?.page);
    if (unique.length > 0) {
      if (unique[0]!.page > 1) unique.unshift({ title: `Pages 1-${unique[0]!.page - 1}`, page: 1 });
      return unique;
    }
    return Array.from({ length: Math.ceil(pdf.numPages / PDF_SECTION_PAGE_COUNT) }, (_, index) => {
      const page = index * PDF_SECTION_PAGE_COUNT + 1;
      return {
        page,
        title: `Pages ${page}-${Math.min(page + PDF_SECTION_PAGE_COUNT - 1, pdf.numPages)}`,
      };
    });
  }
}
