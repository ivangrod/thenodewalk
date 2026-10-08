'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactElement } from 'react';
import type { KnowledgeGraphNode } from '@thenodewalk/contracts';
import { Button } from '@/components/ui/button';

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
    <Dialog.Root
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="knowledge-graph-theme fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-2 border-primary bg-card p-6 text-card-foreground shadow-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger?.isConnected) trigger.focus();
          }}
        >
          <Dialog.Title className="pr-8 text-xl font-semibold">
            {source?.articleTitle || 'Article title unavailable'}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Source for {node?.label}
          </Dialog.Description>
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
                    {new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(
                      date,
                    )}
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
          <Dialog.Close
            aria-label="Close article details"
            className="absolute right-4 top-4 rounded-md px-2 py-1 hover:bg-secondary"
          >
            ✕
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
