CREATE TABLE "feed_last_publication_dates" (
 "id" TEXT NOT NULL, "blogName" TEXT NOT NULL, "feedUrl" TEXT NOT NULL,
 "lastPublishedAt" TIMESTAMPTZ(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "feed_last_publication_dates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feed_last_publication_dates_blogName_key" ON "feed_last_publication_dates"("blogName");
