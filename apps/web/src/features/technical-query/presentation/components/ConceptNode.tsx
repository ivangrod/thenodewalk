'use client';

import { createContext, useContext, type ReactElement } from 'react';
import type { KnowledgeGraphNode } from '@thenodewalk/contracts';
import { useSelectedConceptStore } from '../stores/useSelectedConceptStore';

export interface ConceptGraphNode extends KnowledgeGraphNode {
  isCentral: boolean;
}

export const SourceActivationContext = createContext<
  (node: ConceptGraphNode, trigger: HTMLButtonElement) => void
>(() => undefined);

export function ConceptNode({ node }: { node: ConceptGraphNode }): ReactElement {
  const selectedNodeId = useSelectedConceptStore((state) => state.selectedNodeId);
  const select = useSelectedConceptStore((state) => state.select);
  const openSource = useContext(SourceActivationContext);
  const label = `${node.label}${node.isCentral ? ', main idea' : ''}`;
  return (
    <button
      type="button"
      aria-label={`${label}, ${node.sourceUrl ? 'view article details' : 'no linked source'}`}
      aria-haspopup={node.sourceUrl ? 'dialog' : undefined}
      className={`w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-4 py-3 text-center text-sm font-medium shadow-sm ${selectedNodeId === node.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-secondary'} ${node.isCentral ? 'border-primary' : 'border-border'}`}
      onFocus={() => select(node.id)}
      onClick={(event) => {
        select(node.id);
        if (node.sourceUrl) openSource(node, event.currentTarget);
      }}
    >
      {node.isCentral ? (
        <span className="block text-xs font-semibold uppercase tracking-wide">Main idea</span>
      ) : null}
      {node.label}
      {node.sourceUrl ? (
        <span aria-hidden="true" className="mt-1 block text-xs">
          View article ↗
        </span>
      ) : null}
    </button>
  );
}
