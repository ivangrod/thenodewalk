import { Module } from '@nestjs/common';

import { HealthModule } from './health/infrastructure/http/health.module';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
