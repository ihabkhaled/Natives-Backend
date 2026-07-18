/**
 * Application-owned unit-of-work / transaction contract. Use cases and services
 * depend on this port, never on a `DataSource` or `EntityManager`; the TypeORM
 * implementation lives in src/database. The contract carries no vendor types so
 * the persistence engine can be swapped without touching application code.
 */

/**
 * A vendor-free handle to the active transaction. The only way persistence code
 * enlists work in the surrounding unit of work. `run` executes a single
 * parameterized statement — values are always bound, never interpolated.
 */
export interface TransactionScope {
  run<TRow>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<TRow[]>;
}

export type TransactionalOperation<TResult> = (
  scope: TransactionScope,
) => Promise<TResult>;

export interface UnitOfWorkPort {
  /**
   * Run `operation` inside a single database transaction: commit on success,
   * roll back on any thrown error, and always release the connection.
   */
  runInTransaction<TResult>(
    operation: TransactionalOperation<TResult>,
  ): Promise<TResult>;
}

export const UNIT_OF_WORK_PORT = Symbol('UNIT_OF_WORK_PORT');
