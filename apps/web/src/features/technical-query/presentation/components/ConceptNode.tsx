'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';

import { useSelectedConceptStore } from '../stores/useSelectedConceptStore';

export interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  /** URL of the post linked to the concept, or `null` when it has none. */
  sourceUrl: string | null;
}

export type ConceptFlowNode = Node<ConceptNodeData, 'concept'>;

const BASE_CLASS_NAME =
  'block rounded-xl border px-4 py-2 text-sm font-medium no-underline shadow-sm transition-colors focus-visible:outline-none';
const SELECTED_CLASS_NAME = 'border-primary bg-primary text-primary-foreground';
const IDLE_CLASS_NAME = 'border-border bg-card text-card-foreground hover:bg-secondary';

/**
 * A knowledge-graph concept. When it is linked to a post it renders as an
 * accessible link that opens the source in a new tab; otherwise it renders as a
 * selectable button. Both are keyboard operable with a visible focus state.
 */
export function ConceptNode({ id, data }: NodeProps<ConceptFlowNode>): ReactElement {
  const selectedNodeId = useSelectedConceptStore((state) => state.selectedNodeId);
  const select = useSelectedConceptStore((state) => state.select);
  const className = `${BASE_CLASS_NAME} ${selectedNodeId === id ? SELECTED_CLASS_NAME : IDLE_CLASS_NAME}`;
  const selectConcept = (): void => select(id);

  return (
    <div className="rounded-xl">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      {data.sourceUrl === null ? (
        <button
          aria-label={`${data.label}, no linked source`}
          className={className}
          onClick={selectConcept}
          onFocus={selectConcept}
          type="button"
        >
          {data.label}
        </button>
      ) : (
        <a
          aria-label={`${data.label}, open source in a new tab`}
          className={className}
          href={data.sourceUrl}
          onClick={selectConcept}
          onFocus={selectConcept}
          rel="noreferrer noopener"
          target="_blank"
        >
          {data.label}
        </a>
      )}
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
