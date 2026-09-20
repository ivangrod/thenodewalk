'use client';

import { useCallback, useState } from 'react';

import type { TechnicalQueryResult, TechnicalQueryStatus } from '../../domain/technical-query';

export interface UseTechnicalQuery {
  status: TechnicalQueryStatus;
  result: TechnicalQueryResult | null;
  submittedQuery: string | null;
  ask: (query: string) => void;
}

/**
 * Owns the data boundary for the technical-query feature.
 *
 * For now it only captures the submitted question so the UI can reserve and
 * label the graph area. Sending the query to `POST /technical-queries` and
 * mapping the structured graph response is added in later plan phases; no
 * network request happens yet.
 */
export function useTechnicalQuery(): UseTechnicalQuery {
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  const ask = useCallback((query: string): void => {
    const trimmed = query.trim();
    setSubmittedQuery(trimmed === '' ? null : trimmed);
  }, []);

  return {
    status: 'idle',
    result: null,
    submittedQuery,
    ask,
  };
}
