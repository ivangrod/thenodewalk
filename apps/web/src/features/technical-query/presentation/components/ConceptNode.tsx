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
  const initials = node.label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <button
      type="button"
      aria-label={`${label}, ${node.sourceUrl ? 'view article details' : 'no linked source'}`}
      aria-haspopup={node.sourceUrl ? 'dialog' : undefined}
      className={`flex w-52 -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm shadow-lg transition-colors ${selectedNodeId === node.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-secondary'} ${node.isCentral ? 'border-primary' : node.sourceUrl ? 'border-cyan-400/50' : 'border-violet-400/50'}`}
      onFocus={() => select(node.id)}
      onClick={(event) => {
        select(node.id);
        if (node.sourceUrl) openSource(node, event.currentTarget);
      }}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-950 ${node.isCentral ? 'bg-indigo-300' : node.sourceUrl ? 'bg-cyan-300' : 'bg-violet-300'}`}
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{node.label}</span>
        <span className="mt-1 block text-xs opacity-80">
          {node.isCentral ? 'Main idea' : node.source?.blogName || 'Concept'}
        </span>
        {node.sourceUrl ? (
          <span aria-hidden="true" className="mt-1 block text-xs opacity-80">
            View article ↗
          </span>
        ) : null}
      </span>
    </button>
  );
}
