export enum HealthState {
  Ok = 'ok',
}

export const HEALTH_STATE_VALUES: readonly HealthState[] =
  Object.values(HealthState);

export enum ReadinessState {
  Ready = 'ready',
}

export const READINESS_STATE_VALUES: readonly ReadinessState[] =
  Object.values(ReadinessState);

export enum DependencyState {
  Up = 'up',
}

export const DEPENDENCY_STATE_VALUES: readonly DependencyState[] =
  Object.values(DependencyState);
