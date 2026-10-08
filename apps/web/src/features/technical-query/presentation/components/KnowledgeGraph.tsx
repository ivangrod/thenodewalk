'use client';

import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';

import type { KnowledgeGraph as KnowledgeGraphModel } from '@thenodewalk/contracts';

function GraphSkeleton(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="h-[36rem] w-full animate-pulse rounded-2xl border bg-muted lg:h-[calc(100vh-8rem)]"
    />
  );
}

const KnowledgeGraphCanvas = dynamic(() => import('./KnowledgeGraphCanvas'), {
  ssr: false,
  loading: () => <GraphSkeleton />,
});

export interface KnowledgeGraphProps {
  graph: KnowledgeGraphModel;
}

/**
 * Lazy boundary for the D3 canvas: keeps the visualization library out
 * of the initial bundle and off the server render (`ssr: false`).
 */
export function KnowledgeGraph({ graph }: KnowledgeGraphProps): ReactElement {
  return <KnowledgeGraphCanvas graph={graph} />;
}
