import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { TechnicalQueryView } from '@/features/technical-query/presentation/components/TechnicalQueryView';

export const metadata: Metadata = {
  title: 'Ask a technical question',
};

export default function AskPage(): ReactElement {
  return (
    <main className="min-h-screen bg-background px-6 py-12 sm:py-16">
      <TechnicalQueryView />
    </main>
  );
}
