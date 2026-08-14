import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@thenodewalk/contracts';

import { GetHealthStatusUseCase } from '../../application/get-health-status.use-case';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly getHealthStatus: GetHealthStatusUseCase) {}

  @Get()
  @ApiOkResponse({ description: 'The API is available.' })
  getHealth(): HealthResponse {
    return this.getHealthStatus.execute();
  }
}
