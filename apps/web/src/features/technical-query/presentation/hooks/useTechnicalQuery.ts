'use client';

import { useCallback, useState } from 'react';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

import type { TechnicalQueryStatus } from '../../domain/technical-query';
import { requestTechnicalQuery } from '../../infrastructure/technical-query.client';

export interface UseTechnicalQuery {
  ask: (query: string) => Promise<void>;
  data: TechnicalQueryResponse | null;
  status: TechnicalQueryStatus;
  lastQuery: string | null;
}

/**
 * Presentation adapter that owns the technical-query server-state at its data
 * boundary: it calls `POST /technical-queries` and exposes the request status
 * and response to dumb components. Server data is not cached in Zustand.
 */
export function useTechnicalQuery(): UseTechnicalQuery {
  const [status, setStatus] = useState<TechnicalQueryStatus>('idle');
  const [data, setData] = useState<TechnicalQueryResponse | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  const ask = useCallback(async (query: string): Promise<void> => {
    const trimmed = query.trim();
    if (trimmed === '') {
      return;
    }

    setLastQuery(trimmed);
    setStatus('loading');

    try {
      const response = await requestTechnicalQuery(trimmed);
      setData(response);
      setStatus('success');
    } catch {
      setData(null);
      setStatus('error');
    }
  }, []);

  return { ask, data, status, lastQuery };
}
