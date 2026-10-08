export interface IngestedBookPrimitives {
  bookId: string;
  filePath: string;
  title: string;
  chunkCount: number;
  ingestedAt: string;
}

export type IngestedBook = IngestedBookPrimitives;
