CREATE TABLE "ingested_books" (
    "book_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "chunk_count" INTEGER NOT NULL,
    "ingested_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingested_books_pkey" PRIMARY KEY ("book_id")
);
