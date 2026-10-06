import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import type { FeedLastPublicationDate } from '../../domain/feed-last-publication-date';
import type { FeedLastPublicationDateRepository } from '../../domain/feed-last-publication-date-repository';

@Injectable()
export class PrismaFeedLastPublicationDateRepository implements FeedLastPublicationDateRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(): Promise<FeedLastPublicationDate[]> {
    const records = await this.prisma.feedLastPublicationDate.findMany({
      select: { blogName: true, lastPublishedAt: true },
    });
    return records.map((record) => ({
      blogName: record.blogName,
      lastPublishedAt: record.lastPublishedAt.toISOString(),
    }));
  }

  async save(record: FeedLastPublicationDate & { feedUrl: string }): Promise<void> {
    // Parameterized atomic upsert: an older concurrent run must never rewind a cursor.
    await this.prisma.$executeRaw`
      INSERT INTO feed_last_publication_dates
        (id, "blogName", "feedUrl", "lastPublishedAt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${record.blogName}, ${record.feedUrl},
        ${new Date(record.lastPublishedAt)}, NOW(), NOW())
      ON CONFLICT ("blogName") DO UPDATE SET
        "feedUrl" = EXCLUDED."feedUrl",
        "lastPublishedAt" = EXCLUDED."lastPublishedAt",
        "updatedAt" = NOW()
      WHERE feed_last_publication_dates."lastPublishedAt" < EXCLUDED."lastPublishedAt"
    `;
  }
}
