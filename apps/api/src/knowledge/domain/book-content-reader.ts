export interface BookFile {
  filePath: string;
  format: 'epub' | 'pdf';
  category: string | null;
}

export interface BookSection {
  index: number;
  title: string;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface BookContent {
  contentHash: string;
  title: string;
  authors: string[];
  sections: BookSection[];
}

export interface BookContentReader {
  read(file: BookFile): Promise<BookContent>;
}

export class UnsupportedBookFormatError extends Error {
  constructor(format: string) {
    super(`Unsupported book format: ${format}`);
    this.name = 'UnsupportedBookFormatError';
  }
}
