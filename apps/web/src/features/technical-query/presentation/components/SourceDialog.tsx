'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactElement, ReactNode } from 'react';

/**
 * Shared, accessible frame for source details: Radix traps focus, closes on
 * Escape or the close control, and focus returns to the node that opened it.
 */
export function SourceDialog({
  open,
  onClose,
  trigger,
  title,
  description,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  trigger: HTMLButtonElement | null;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
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
          <Dialog.Title className="pr-8 text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          {children}
          <Dialog.Close
            aria-label={closeLabel}
            className="absolute right-4 top-4 rounded-md px-2 py-1 hover:bg-secondary"
          >
            ✕
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
