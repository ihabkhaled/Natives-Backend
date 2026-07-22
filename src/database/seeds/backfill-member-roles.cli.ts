import { NestFactory } from '@nestjs/core';
import type { DataSource } from 'typeorm';

import { AppModule } from '@/app.module';

import { DATA_SOURCE } from '../database.constants';
import {
  describeDatabaseCliError,
  writeDatabaseCliMessage,
} from '../database-cli.helpers';
import { runMemberRoleBackfill } from './backfill-member-roles';
import {
  BACKFILL_APPLY_FLAG,
  BACKFILL_APPLY_HEADER,
  BACKFILL_DRY_RUN_HEADER,
  BACKFILL_FAILED_PREFIX,
  BACKFILL_NOTHING_TO_DO_MESSAGE,
} from './backfill-member-roles.constants';
import type { BackfillResult } from './backfill-member-roles.types';

// Operator-reviewed reconciliation for memberships linked before acceptance
// granted a role (prompt 100). Dry-run by default; `--apply` performs the
// reviewed grants inside one transaction. Never run automatically.
function report(result: BackfillResult, apply: boolean): void {
  if (result.candidates.length === 0) {
    writeDatabaseCliMessage(BACKFILL_NOTHING_TO_DO_MESSAGE);
    return;
  }
  writeDatabaseCliMessage(
    apply ? BACKFILL_APPLY_HEADER : BACKFILL_DRY_RUN_HEADER,
  );
  for (const candidate of result.candidates) {
    writeDatabaseCliMessage(
      `membership=${candidate.membershipId} user=${candidate.userId} team=${candidate.teamId}`,
    );
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes(BACKFILL_APPLY_FLAG);
  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
    logger: ['error', 'warn'],
  });
  try {
    const dataSource = app.get<DataSource>(DATA_SOURCE);
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      const result = await runMemberRoleBackfill(queryRunner, apply);
      await queryRunner.commitTransaction();
      report(result, apply);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${BACKFILL_FAILED_PREFIX}: ${describeDatabaseCliError(error)}\n`,
  );
  process.exitCode = 1;
});
