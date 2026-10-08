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

const SOURCE_BADGE_TEXT = { post: 'Post', book: 'Book' } as const;

/**
 * A knowledge-graph concept rendered as a keyboard-operable button. Post nodes
 * open an accessible dialog with grounded article details before navigating; book
 * nodes are selectable and expose their book and section in the accessible name.
 * The source type and the central node are identified by visible text, never by
 * colour alone.
 */
export function ConceptNode({ node }: { node: ConceptGraphNode }): ReactElement {
  const selectedNodeId = useSelectedConceptStore((state) => state.selectedNodeId);
  const select = useSelectedConceptStore((state) => state.select);
  const openSource = useContext(SourceActivationContext);
  const { source } = node;
  const opensDialog = source?.kind === 'post';
  const initials = node.label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  const accentClassName = node.isCentral
    ? 'border-primary'
    : source?.kind === 'post'
      ? 'border-cyan-400/50'
      : source?.kind === 'book'
        ? 'border-amber-400/50'
        : 'border-violet-400/50';
  const avatarClassName = node.isCentral
    ? 'bg-indigo-300'
    : source?.kind === 'post'
      ? 'bg-cyan-300'
      : source?.kind === 'book'
        ? 'bg-amber-300'
        : 'bg-violet-300';
  const subtitle = node.isCentral
    ? 'Main idea'
    : source?.kind === 'post'
      ? source.blogName || 'Concept'
      : source?.kind === 'book'
        ? source.bookTitle
        : 'Concept';

  return (
    <button
      type="button"
      aria-label={accessibleNameOf(node)}
      aria-haspopup={opensDialog ? 'dialog' : undefined}
      className={`flex w-52 -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm shadow-lg transition-colors ${selectedNodeId === node.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-secondary'} ${accentClassName}`}
      onFocus={() => select(node.id)}
      onClick={(event) => {
        select(node.id);
        if (opensDialog) openSource(node, event.currentTarget);
      }}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-950 ${avatarClassName}`}
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{node.label}</span>
        <span className="mt-1 block text-xs opacity-80">{subtitle}</span>
        {source ? (
          <span className="mt-1 block text-xs font-semibold">{SOURCE_BADGE_TEXT[source.kind]}</span>
        ) : null}
        {opensDialog ? (
          <span aria-hidden="true" className="mt-1 block text-xs opacity-80">
            View article ↗
          </span>
        ) : null}
      </span>
    </button>
  );
}

function accessibleNameOf(node: ConceptGraphNode): string {
  const { source } = node;
  const mainIdea = node.isCentral ? ', main idea' : '';
  if (source?.kind === 'book') {
    const section = source.sectionTitle ? `, ${source.sectionTitle}` : '';
    const page = source.pageStart === null ? '' : `, page ${source.pageStart}`;
    return `${node.label}, from the book ${source.bookTitle}${section}${page}${mainIdea}`;
  }
  return `${node.label}${mainIdea}, ${source?.kind === 'post' ? 'view article details' : 'no linked source'}`;
}
