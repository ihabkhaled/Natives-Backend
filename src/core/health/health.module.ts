import { Module } from '@nestjs/common';

import { ClockModule } from '../clock/clock.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';

// The DATABASE_READINESS_PORT is provided by the global DatabaseModule, so the
// readiness service resolves it without importing the persistence layer.
@Module({
  imports: [ClockModule],
  controllers: [HealthController],
  providers: [HealthService, ReadinessService],
})
export class HealthModule {}
