import type {
  TransactionalOperation,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DATA_SOURCE } from './database.constants';
import { toDatabaseError } from './database-error.mapper';
import { TypeormTransactionScope } from './typeorm-transaction-scope';

/**
 * TypeORM implementation of the application-owned unit-of-work port. Opens a
 * dedicated transaction, commits on success, rolls back on any thrown error,
 * and always releases the connection. This is the only unit-of-work aware of
 * TypeORM — use cases depend on `UnitOfWorkPort`.
 */
@Injectable()
export class TypeormUnitOfWorkAdapter implements UnitOfWorkPort {
  constructor(@Inject(DATA_SOURCE) private readonly dataSource: DataSource) {}

  async runInTransaction<TResult>(
    operation: TransactionalOperation<TResult>,
  ): Promise<TResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await operation(new TypeormTransactionScope(queryRunner));
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw toDatabaseError(error);
    } finally {
      await queryRunner.release();
    }
  }
}
