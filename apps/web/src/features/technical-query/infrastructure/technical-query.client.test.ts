import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

import { requestTechnicalQuery } from './technical-query.client';

const RESPONSE: TechnicalQueryResponse = {
  summary: 'answer',
  graph: { nodes: [], edges: [] },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestTechnicalQuery', () => {
  it('posts the query to the API and returns the parsed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(RESPONSE),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestTechnicalQuery('how to scale?', { baseUrl: 'http://api.test' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/technical-queries',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'how to scale?' }),
      }),
    );
    expect(result).toEqual(RESPONSE);
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(requestTechnicalQuery('x', { baseUrl: 'http://api.test' })).rejects.toThrow(/500/);
  });
});
