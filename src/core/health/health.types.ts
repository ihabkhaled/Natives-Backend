export interface HealthStatus {
  readonly status: 'ok';
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}
