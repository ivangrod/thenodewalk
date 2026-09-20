/**
 * Injection tokens for the `knowledge` context ports. Interfaces do not exist at
 * runtime, so ports are bound to their adapters through these tokens.
 */
export const KNOWLEDGE_CHUNK_REPOSITORY = 'KNOWLEDGE_CHUNK_REPOSITORY';
export const EMBEDDING_GENERATOR = 'EMBEDDING_GENERATOR';
export const FEED_SUBSCRIPTION_READER = 'FEED_SUBSCRIPTION_READER';
export const ARTICLE_FEED_READER = 'ARTICLE_FEED_READER';
export const READABLE_ARTICLE_READER = 'READABLE_ARTICLE_READER';
