import { Injectable } from '@nestjs/common';

import { HEALTH_STATUS_OK } from './health.constants';
import type { HealthStatus } from './health.types';

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      status: HEALTH_STATUS_OK,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
