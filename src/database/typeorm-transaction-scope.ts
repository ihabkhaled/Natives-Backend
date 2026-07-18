import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import type { QueryRunner } from 'typeorm';

/**
 * Vendor-free view over a TypeORM `QueryRunner` bound to the active
 * transaction. Statements run through the query runner so every operation joins
 * the surrounding unit of work; parameters are always bound, never interpolated.
 */
export class TypeormTransactionScope implements TransactionScope {
  constructor(private readonly queryRunner: QueryRunner) {}

  async run<TRow>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<TRow[]> {
    const result: unknown = await this.queryRunner.query(
      statement,
      parameters === undefined ? undefined : [...parameters],
    );
    return normalizeQueryResult<TRow>(result);
  }
}

/**
 * TypeORM's postgres driver returns a plain rows array for SELECT/INSERT, but an
 * `[rows, affectedCount]` tuple for UPDATE/DELETE ... RETURNING. Unwrap that
 * tuple so persistence code always receives the rows directly. A genuine rows
 * array is never `[array, number]` (rows are objects), so the shape check is
 * unambiguous.
 */
function normalizeQueryResult<TRow>(result: unknown): TRow[] {
  if (
    Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as TRow[];
  }
  return result as TRow[];
}
