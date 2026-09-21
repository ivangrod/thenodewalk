'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';

import { useSelectedConceptStore } from '../stores/useSelectedConceptStore';

export interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  sourceUrl: string;
}

export type ConceptFlowNode = Node<ConceptNodeData, 'concept'>;

/**
 * A knowledge-graph concept rendered as an accessible link. It opens the concept
 * source in a new tab and is fully keyboard operable with a visible focus ring.
 */
export function ConceptNode({ id, data }: NodeProps<ConceptFlowNode>): ReactElement {
  const selectedNodeId = useSelectedConceptStore((state) => state.selectedNodeId);
  const select = useSelectedConceptStore((state) => state.select);
  const isSelected = selectedNodeId === id;

  return (
    <div className="rounded-xl">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <a
        aria-label={`${data.label}, open source in a new tab`}
        className={`block rounded-xl border px-4 py-2 text-sm font-medium no-underline shadow-sm transition-colors focus-visible:outline-none ${
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-card-foreground hover:bg-secondary'
        }`}
        href={data.sourceUrl}
        onClick={() => select(id)}
        onFocus={() => select(id)}
        rel="noreferrer noopener"
        target="_blank"
      >
        {data.label}
      </a>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
