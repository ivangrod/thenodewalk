import type { KnowledgeSearchMatch } from './knowledge-chunk-repository';
import type { GeneratedGraph } from './knowledge-graph';

/**
 * Port that turns a question plus the retrieved context into a structured
 * {@link GeneratedGraph}. Implementations force a local LLM to emit strict JSON.
 */
export interface StructuredGraphGenerator {
  generate(query: string, context: KnowledgeSearchMatch[]): Promise<GeneratedGraph>;
}
