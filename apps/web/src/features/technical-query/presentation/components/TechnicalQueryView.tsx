'use client';

import type { ReactElement } from 'react';

import { useTechnicalQuery } from '../hooks/useTechnicalQuery';
import { TechnicalQueryForm } from './TechnicalQueryForm';

export function TechnicalQueryView(): ReactElement {
  const { ask, status, submittedQuery } = useTechnicalQuery();
  const isLoading = status === 'loading';

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

      <TechnicalQueryForm disabled={isLoading} onSubmit={ask} />

      <div
        aria-label="Knowledge graph"
        aria-live="polite"
        className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card p-8 text-center"
        role="region"
      >
        {submittedQuery === null ? (
          <p className="max-w-md text-pretty text-muted-foreground">
            Your knowledge graph will appear here. Ask a question to start walking the nodes.
          </p>
        ) : (
          <p className="max-w-md text-pretty text-muted-foreground">
            Building the knowledge graph for “{submittedQuery}”. The retrieval and generation engine
            is connected in an upcoming milestone.
          </p>
        )}
      </div>
    </section>
  );
}
