import type { TechnicalQueryRequest, TechnicalQueryResponse } from '@thenodewalk/contracts';

const DEFAULT_API_URL = 'http://localhost:3001';

export interface RequestTechnicalQueryOptions {
  baseUrl?: string;
  signal?: AbortSignal;
}

/**
 * Infrastructure adapter that calls `POST /technical-queries` and returns the
 * parsed {@link TechnicalQueryResponse}. Throws on a non-2xx response.
 */
export async function requestTechnicalQuery(
  query: string,
  options: RequestTechnicalQueryOptions = {},
): Promise<TechnicalQueryResponse> {
  const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  const body: TechnicalQueryRequest = { query };

  const response = await fetch(`${baseUrl}/technical-queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Technical query failed with status ${response.status}.`);
  }

  return (await response.json()) as TechnicalQueryResponse;
}
