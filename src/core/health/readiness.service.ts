import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { ServiceUnavailableError } from '@core/errors/service-unavailable.error';
import {
  DATABASE_READINESS_PORT,
  type DatabaseReadinessPort,
} from '@core/persistence/database-readiness.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE_UNAVAILABLE_MESSAGE,
  DATABASE_UNAVAILABLE_MESSAGE_KEY,
} from './health.constants';
import { DependencyState, ReadinessState } from './health.enums';
import type { ReadinessStatus } from './health.types';

/**
 * Readiness (can the process serve traffic?) is distinct from liveness (is the
 * process up?). It pings the database through a vendor-free port; when the
 * database is unreachable it raises a safe 503 error instead of leaking driver
 * internals. `core/health` stays free of any TypeORM import.
 */
@Injectable()
export class ReadinessService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(DATABASE_READINESS_PORT)
    private readonly databaseReadiness: DatabaseReadinessPort,
  ) {}

  async check(): Promise<ReadinessStatus> {
    const result = await this.databaseReadiness.check();
    if (!result.reachable) {
      throw new ServiceUnavailableError(
        DATABASE_UNAVAILABLE_MESSAGE,
        DATABASE_UNAVAILABLE_MESSAGE_KEY,
      );
    }
    return {
      status: ReadinessState.Ready,
      database: DependencyState.Up,
      timestamp: this.clock.now().toISOString(),
    };
  }
}
