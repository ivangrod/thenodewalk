import { Module } from '@nestjs/common';

import { HealthModule } from './health/infrastructure/http/health.module';
import { KnowledgeModule } from './knowledge/infrastructure/knowledge.module';

@Module({
  imports: [HealthModule, KnowledgeModule],
})
export class AppModule {}
