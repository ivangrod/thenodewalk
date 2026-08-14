import { GetHealthStatusUseCase } from './get-health-status.use-case';

describe('GetHealthStatusUseCase', () => {
  it('returns an OK health status and an ISO timestamp', () => {
    const result = new GetHealthStatusUseCase().execute(new Date('2026-08-14T12:00:00.000Z'));

    expect(result).toEqual({
      status: 'ok',
      timestamp: '2026-08-14T12:00:00.000Z',
    });
  });
});
