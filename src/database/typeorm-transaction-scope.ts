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
    return (await this.queryRunner.query(
      statement,
      parameters === undefined ? undefined : [...parameters],
    )) as TRow[];
  }
}
