export type TechnicalQueryStatus = 'idle' | 'loading' | 'error' | 'success';

/**
 * Placeholder shape for the RAG answer rendered on the technical-query page.
 *
 * The final contract (summary + knowledge graph) will live in
 * `@thenodewalk/contracts` once the API is implemented. See the plan phases
 * "Technical-query API with semantic retrieval" and "Structured RAG graph
 * generation".
 */
export interface TechnicalQueryResult {
  summary: string;
}
