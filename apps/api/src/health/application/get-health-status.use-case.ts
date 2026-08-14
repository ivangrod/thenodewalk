import type { HealthStatus } from '../domain/health-status';

export class GetHealthStatusUseCase {
  execute(now: Date = new Date()): HealthStatus {
    return {
      status: 'ok',
      timestamp: now.toISOString(),
    };
  }
}
