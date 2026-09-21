export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface TechnicalQueryRequest {
  query: string;
}

export interface RetrievedChunkDto {
  document: string;
  articleTitle: string;
  articleUrl: string;
  blogName: string;
  score: number;
}

/**
 * Interim response for `POST /technical-queries`: the retrieved source chunks.
 * The structured knowledge graph is added on top of this in Phase 4.
 */
export interface TechnicalQueryResponse {
  chunks: RetrievedChunkDto[];
}
