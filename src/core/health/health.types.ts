import type { HealthState } from './health.enums';

export interface HealthStatus {
  readonly status: HealthState;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}
