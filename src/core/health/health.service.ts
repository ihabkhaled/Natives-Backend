import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { Inject, Injectable } from '@nestjs/common';

import { HEALTH_STATUS_OK } from './health.constants';
import type { HealthStatus } from './health.types';

@Injectable()
export class HealthService {
  constructor(@Inject(CLOCK_PORT) private readonly clock: ClockPort) {}

  check(): HealthStatus {
    return {
      status: HEALTH_STATUS_OK,
      uptimeSeconds: Math.floor(this.clock.uptime()),
      timestamp: this.clock.now().toISOString(),
    };
  }
}
