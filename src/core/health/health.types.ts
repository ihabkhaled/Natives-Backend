import type {
  DependencyState,
  HealthState,
  ReadinessState,
} from './health.enums';

export interface HealthStatus {
  readonly status: HealthState;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}

export interface ReadinessStatus {
  readonly status: ReadinessState;
  readonly database: DependencyState;
  readonly timestamp: string;
}
