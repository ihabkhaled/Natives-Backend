import { Public } from '@core/auth';
import { ApiTags } from '@core/openapi';
import { Controller, Get } from '@nestjs/common';

import {
  HEALTH_API_TAG,
  HEALTH_ROUTE,
  READINESS_ROUTE,
} from './health.constants';
import { HealthService } from './health.service';
import type { HealthStatus, ReadinessStatus } from './health.types';
import { ReadinessService } from './readiness.service';

@ApiTags(HEALTH_API_TAG)
@Controller(HEALTH_ROUTE)
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly readinessService: ReadinessService,
  ) {}

  @Public()
  @Get()
  check(): HealthStatus {
    return this.healthService.check();
  }

  @Public()
  @Get(READINESS_ROUTE)
  ready(): Promise<ReadinessStatus> {
    return this.readinessService.check();
  }
}
