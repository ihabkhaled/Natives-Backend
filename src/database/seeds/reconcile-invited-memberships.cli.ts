import { NestFactory } from '@nestjs/core';
import type { DataSource } from 'typeorm';

import { AppModule } from '@/app.module';

import { DATA_SOURCE } from '../database.constants';
import {
  describeDatabaseCliError,
  writeDatabaseCliMessage,
} from '../database-cli.helpers';
import { runInvitedMembershipReconciliation } from './reconcile-invited-memberships';
import {
  RECONCILE_AMBIGUOUS_NOTE,
  RECONCILE_APPLY_FLAG,
  RECONCILE_APPLY_HEADER,
  RECONCILE_DRY_RUN_HEADER,
  RECONCILE_FAILED_PREFIX,
  RECONCILE_NOTHING_TO_DO_MESSAGE,
} from './reconcile-invited-memberships.constants';
import type {
  OrphanedInvitation,
  ReconcileResult,
} from './reconcile-invited-memberships.types';

// Operator-reviewed repair for invitations whose roster membership was written
// without the email acceptance matches on. Dry-run by default; `--apply`
// performs the reviewed repairs inside one transaction. Never run
// automatically — an unreviewed link attaches a person to a roster record.

/**
 * Ids only, never the address. The email is the one piece of personal data in
 * these rows, and an operator terminal or a CI log is the wrong place for it —
 * the ids join straight back to the record for anyone who needs the rest.
 */
function describe(orphan: OrphanedInvitation): string {
  const target =
    orphan.verdict === 'repairable'
      ? `membership=${String(orphan.membershipId)}`
      : `candidates=${String(orphan.candidateCount)}`;
  return `invitation=${orphan.invitationId} status=${orphan.status} team=${orphan.teamId} role=${orphan.teamRoleKey} ${target}`;
}

function report(result: ReconcileResult, apply: boolean): void {
  if (result.orphans.length === 0) {
    writeDatabaseCliMessage(RECONCILE_NOTHING_TO_DO_MESSAGE);
    return;
  }
  writeDatabaseCliMessage(
    apply ? RECONCILE_APPLY_HEADER : RECONCILE_DRY_RUN_HEADER,
  );
  for (const orphan of result.orphans) {
    writeDatabaseCliMessage(describe(orphan));
    if (orphan.verdict === 'ambiguous') {
      writeDatabaseCliMessage(`  ${RECONCILE_AMBIGUOUS_NOTE}`);
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes(RECONCILE_APPLY_FLAG);
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
      const result = await runInvitedMembershipReconciliation(
        queryRunner,
        apply,
      );
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
    `${RECONCILE_FAILED_PREFIX}: ${describeDatabaseCliError(error)}\n`,
  );
  process.exitCode = 1;
});
