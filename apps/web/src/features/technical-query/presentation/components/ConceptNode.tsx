'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';

import { useSelectedConceptStore } from '../stores/useSelectedConceptStore';

export interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  /** URL of the post linked to the concept, or `null` when it has none. */
  sourceUrl: string | null;
  /** Whether the concept is the central node holding the main idea of the graph. */
  isCentral: boolean;
}

export type ConceptFlowNode = Node<ConceptNodeData, 'concept'>;

const BASE_CLASS_NAME =
  'block rounded-xl border px-4 py-2 text-sm font-medium no-underline shadow-sm transition-colors focus-visible:outline-none';
const CENTRAL_CLASS_NAME = 'border-2 px-5 py-3 text-base font-semibold';
const SELECTED_CLASS_NAME = 'border-primary bg-primary text-primary-foreground';
const IDLE_CLASS_NAME = 'border-border bg-card text-card-foreground hover:bg-secondary';
const IDLE_CENTRAL_CLASS_NAME = 'border-primary bg-card text-card-foreground hover:bg-secondary';

const MAIN_IDEA_TEXT = 'Main idea';

/**
 * A knowledge-graph concept. When it is linked to a post it renders as an
 * accessible link that opens the source in a new tab; otherwise it renders as a
 * selectable button. Both are keyboard operable with a visible focus state. The
 * central node is emphasized and labelled as the "Main idea", both visually and
 * for assistive technologies, so it is not identified by colour alone.
 */
export function ConceptNode({ id, data }: NodeProps<ConceptFlowNode>): ReactElement {
  const selectedNodeId = useSelectedConceptStore((state) => state.selectedNodeId);
  const select = useSelectedConceptStore((state) => state.select);
  const idleClassName = data.isCentral ? IDLE_CENTRAL_CLASS_NAME : IDLE_CLASS_NAME;
  const stateClassName = selectedNodeId === id ? SELECTED_CLASS_NAME : idleClassName;
  const className = [BASE_CLASS_NAME, data.isCentral ? CENTRAL_CLASS_NAME : '', stateClassName]
    .filter(Boolean)
    .join(' ');
  const selectConcept = (): void => select(id);
  const accessibleLabel = data.isCentral ? `${data.label}, main idea` : data.label;
  const content = (
    <>
      {data.isCentral ? (
        <span className="block text-xs font-semibold uppercase tracking-wide">
          {MAIN_IDEA_TEXT}
        </span>
      ) : null}
      {data.label}
    </>
  );

  return (
    <div className="rounded-xl">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      {data.sourceUrl === null ? (
        <button
          aria-label={`${accessibleLabel}, no linked source`}
          className={className}
          onClick={selectConcept}
          onFocus={selectConcept}
          type="button"
        >
          {content}
        </button>
      ) : (
        <a
          aria-label={`${accessibleLabel}, open source in a new tab`}
          className={className}
          href={data.sourceUrl}
          onClick={selectConcept}
          onFocus={selectConcept}
          rel="noreferrer noopener"
          target="_blank"
        >
          {content}
        </a>
      )}
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
