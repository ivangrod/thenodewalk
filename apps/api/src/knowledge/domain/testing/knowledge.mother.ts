import { faker } from '@faker-js/faker';

import type { FeedArticle } from '../article-feed-reader';
import type { FeedSubscription } from '../feed-subscription-reader';
import {
  createKnowledgeChunk,
  type KnowledgeChunk,
  type KnowledgeChunkMetadata,
} from '../knowledge-chunk';

export class FeedSubscriptionMother {
  static create(params?: Partial<FeedSubscription>): FeedSubscription {
    return {
      blogName: faker.company.name(),
      feedUrl: faker.internet.url(),
      ...params,
    };
  }
}

export class FeedArticleMother {
  static create(params?: Partial<FeedArticle>): FeedArticle {
    return {
      title: faker.lorem.sentence(),
      url: faker.internet.url(),
      publishedAt: faker.date.recent().toISOString(),
      ...params,
    };
  }
}

export class KnowledgeChunkMetadataMother {
  static create(params?: Partial<KnowledgeChunkMetadata>): KnowledgeChunkMetadata {
    return {
      blogName: faker.company.name(),
      articleTitle: faker.lorem.sentence(),
      articleUrl: faker.internet.url(),
      publishedAt: faker.date.recent().toISOString(),
      chunkIndex: faker.number.int({ min: 0, max: 20 }),
      ...params,
    };
  }
}

export class KnowledgeChunkMother {
  static create(
    params?: Partial<{ document: string; embedding: number[] } & KnowledgeChunkMetadata>,
  ): KnowledgeChunk {
    const { document, embedding, ...metadata } = params ?? {};
    return createKnowledgeChunk({
      document: document ?? faker.lorem.paragraph(),
      embedding: embedding ?? [faker.number.float(), faker.number.float()],
      metadata: KnowledgeChunkMetadataMother.create(metadata),
    });
  }
}
