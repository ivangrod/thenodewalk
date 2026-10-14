'use client';

import type { ReactElement } from 'react';
import type { KnowledgeGraphNode } from '@thenodewalk/contracts';
import { Button } from '@/components/ui/button';
import { SourceDialog } from './SourceDialog';

export function ArticleSourceDialog({
  node,
  onClose,
  trigger,
}: {
  node: KnowledgeGraphNode | null;
  onClose: () => void;
  trigger: HTMLButtonElement | null;
}): ReactElement {
  const source = node?.source?.kind === 'post' ? node.source : null;
  const date =
    source?.publishedAt && Number.isFinite(Date.parse(source.publishedAt))
      ? new Date(source.publishedAt)
      : null;
  const href = source?.url && /^https?:\/\//i.test(source.url) ? source.url : null;
  return (
    <SourceDialog
      open={source !== null}
      onClose={onClose}
      trigger={trigger}
      title={source?.articleTitle || 'Article title unavailable'}
      description={`Source for ${node?.label ?? ''}`}
      closeLabel="Close article details"
    >
      <dl className="my-6 space-y-4 text-sm">
        <div>
          <dt className="font-semibold">Origin</dt>
          <dd>{source?.blogName || 'Origin unavailable'}</dd>
        </div>
        <div>
          <dt className="font-semibold">Published</dt>
          <dd>
            {date ? (
              <time dateTime={date.toISOString()}>
                {new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(date)}
              </time>
            ) : (
              'Publication date unavailable'
            )}
          </dd>
        </div>
      </dl>
      {href ? (
        <Button asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            Go to {source?.blogName || 'article'}
            <span className="sr-only"> (opens in a new tab)</span>
            <span aria-hidden="true">↗</span>
          </a>
        </Button>
      ) : (
        <p className="text-sm">Source link unavailable</p>
      )}
    </SourceDialog>
  );
}
