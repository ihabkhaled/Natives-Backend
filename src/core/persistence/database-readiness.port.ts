/**
 * Application-owned database readiness contract. `core/health` depends on this
 * port so it can report readiness without importing TypeORM; the implementation
 * that actually pings the database lives in src/database. The result is a plain
 * boolean — driver internals never cross this boundary.
 */
export interface DatabaseReadinessResult {
  readonly reachable: boolean;
}

export interface DatabaseReadinessPort {
  check(): Promise<DatabaseReadinessResult>;
}

export const DATABASE_READINESS_PORT = Symbol('DATABASE_READINESS_PORT');
