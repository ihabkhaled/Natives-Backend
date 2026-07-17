import { Public } from '@core/auth';
import { ApiTags } from '@core/openapi';
import { Controller, Get } from '@nestjs/common';

import { HEALTH_API_TAG, HEALTH_ROUTE } from './health.constants';
import { HealthService } from './health.service';
import type { HealthStatus } from './health.types';

@ApiTags(HEALTH_API_TAG)
@Controller(HEALTH_ROUTE)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check(): HealthStatus {
    return this.healthService.check();
  }
}
