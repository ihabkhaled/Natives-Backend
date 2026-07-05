import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { HealthService } from './health.service';
import type { HealthStatus } from './health.types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthStatus {
    return this.healthService.check();
  }
}
