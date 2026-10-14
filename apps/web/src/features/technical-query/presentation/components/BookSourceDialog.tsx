'use client';

import type { ReactElement } from 'react';
import type { KnowledgeGraphNode } from '@thenodewalk/contracts';
import { SourceDialog } from './SourceDialog';

/**
 * Details of a book section: the book title, its section and starting page, and
 * the passage that matched the question. The passage comes verbatim from the
 * indexed book text. No link is offered because local files are never exposed.
 */
export function BookSourceDialog({
  node,
  onClose,
  trigger,
}: {
  node: KnowledgeGraphNode | null;
  onClose: () => void;
  trigger: HTMLButtonElement | null;
}): ReactElement {
  const source = node?.source?.kind === 'book' ? node.source : null;
  return (
    <SourceDialog
      open={source !== null}
      onClose={onClose}
      trigger={trigger}
      title={source?.bookTitle || 'Book title unavailable'}
      description={`Source for ${node?.label ?? ''}`}
      closeLabel="Close book details"
    >
      <dl className="my-6 space-y-4 text-sm">
        <div>
          <dt className="font-semibold">Section</dt>
          <dd>{source?.sectionTitle || 'Section unavailable'}</dd>
        </div>
        {source?.pageStart != null ? (
          <div>
            <dt className="font-semibold">Section starts on page</dt>
            <dd>{source.pageStart}</dd>
          </div>
        ) : null}
      </dl>
      <figure>
        <figcaption className="text-sm font-semibold">Matching excerpt</figcaption>
        {source?.excerpt ? (
          <blockquote className="mt-2 border-l-4 border-primary pl-4 text-sm leading-6">
            {source.excerpt}
          </blockquote>
        ) : (
          <p className="mt-2 text-sm">Excerpt unavailable</p>
        )}
      </figure>
    </SourceDialog>
  );
}
