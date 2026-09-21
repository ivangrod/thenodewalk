'use client';

import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

import { useTechnicalQuery } from '../hooks/useTechnicalQuery';
import { KnowledgeGraph } from './KnowledgeGraph';
import { TechnicalQueryForm } from './TechnicalQueryForm';

const LOADING_MESSAGE = 'Building your knowledge graph…';
const IDLE_MESSAGE =
  'Your knowledge graph will appear here. Ask a question to start walking the nodes.';
const EMPTY_MESSAGE =
  'No sources matched your question yet. Try another question or ingest more engineering blogs.';
const ERROR_MESSAGE = 'Something went wrong while building your graph.';

export function TechnicalQueryView(): ReactElement {
  const { ask, data, status, lastQuery } = useTechnicalQuery();
  const isLoading = status === 'loading';
  const hasGraph = status === 'success' && data !== null && data.graph.nodes.length > 0;

  return (
    <section
      aria-labelledby="technical-query-title"
      className="mx-auto flex w-full max-w-3xl flex-col gap-8"
    >
      <header className="flex flex-col gap-3">
        <h1
          className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          id="technical-query-title"
        >
          Ask a technical question
        </h1>
        <p className="text-pretty text-lg leading-8 text-muted-foreground">
          Query the collected engineering knowledge and explore the answer as a connected graph of
          concepts, each linking back to its original source.
        </p>
      </header>

      <TechnicalQueryForm disabled={isLoading} onSubmit={(query) => void ask(query)} />

      <div aria-live="polite" className="flex flex-col gap-4">
        {status === 'idle' && <PlaceholderRegion message={IDLE_MESSAGE} />}

        {status === 'loading' && <PlaceholderRegion message={LOADING_MESSAGE} />}

        {status === 'error' && (
          <div
            className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card p-8 text-center"
            role="alert"
          >
            <p className="max-w-md text-pretty text-muted-foreground">{ERROR_MESSAGE}</p>
            {lastQuery !== null && (
              <Button onClick={() => void ask(lastQuery)} variant="secondary">
                Try again
              </Button>
            )}
          </div>
        )}

        {status === 'success' && data !== null && !hasGraph && (
          <PlaceholderRegion message={EMPTY_MESSAGE} />
        )}

        {hasGraph && data !== null && (
          <article className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Summary</h2>
            <p className="text-pretty leading-7">{data.summary}</p>
            <KnowledgeGraph graph={data.graph} />
          </article>
        )}
      </div>
    </section>
  );
}

function PlaceholderRegion({ message }: { message: string }): ReactElement {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card p-8 text-center">
      <p className="max-w-md text-pretty text-muted-foreground">{message}</p>
    </div>
  );
}
