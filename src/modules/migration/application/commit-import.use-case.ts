import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  isCommittable,
  isReversible,
} from '../domain/import-job.state-machine';
import { ImportNotCommittableError } from '../errors/import-not-committable.error';
import { ImportNotReversibleError } from '../errors/import-not-reversible.error';
import { MigrationVersionConflictError } from '../errors/migration-version-conflict.error';
import { ImportJobRepository } from '../infrastructure/import-job.repository';
import {
  buildImportAudit,
  buildReconciliation,
  buildReversalJob,
} from '../lib/migration.builders';
import {
  IMPORT_COMMITTED_ACTION,
  IMPORT_REVERSED_ACTION,
} from '../model/migration.constants';
import { ImportStatus } from '../model/migration.enums';
import type {
  ImportJob,
  ImportReconciliationSummary,
} from '../model/migration.types';
import { MigrationLookupService } from './migration-lookup.service';

/**
 * Commits a staged import and reverses a committed one (UN-702).
 *
 * Commit is a distinct, guarded step (a dry-run job can never be committed), and
 * every staged row becomes a committed row through the same idempotency guard.
 * Reversal creates a COMPENSATING job that supersedes the original and marks it
 * reversed — so an import is never an irreversible one-way door, and the audit
 * trail records both the import and its reversal.
 */
@Injectable()
export class CommitImportUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: MigrationLookupService,
    private readonly imports: ImportJobRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  commit(
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<ImportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCommit(tx, actor, teamId, jobId),
    );
  }

  reverse(
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<ImportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runReverse(tx, actor, teamId, jobId),
    );
  }

  private async runCommit(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<ImportJob> {
    const job = await this.lookup.requireImport(tx, teamId, jobId);
    if (!isCommittable(job.status, job.dryRun)) {
      throw new ImportNotCommittableError();
    }
    const committed = await this.imports.reconcile(
      tx,
      buildReconciliation(
        job,
        {
          received: job.receivedRows,
          staged: 0,
          committed: job.stagedRows,
          skippedDuplicate: job.skippedRows,
          error: job.errorRows,
          quarantined: job.quarantinedRows,
        },
        ImportStatus.Committed,
        true,
        false,
        this.clock.now(),
      ),
    );
    if (committed === null) {
      throw new MigrationVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildImportAudit(IMPORT_COMMITTED_ACTION, actor.userId, committed),
    );
    return committed;
  }

  private async runReverse(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<ImportJob> {
    const job = await this.lookup.requireImport(tx, teamId, jobId);
    if (!isReversible(job.status)) {
      throw new ImportNotReversibleError();
    }
    const marked = await this.imports.reconcile(
      tx,
      buildReconciliation(
        job,
        this.summaryOf(job),
        ImportStatus.Reversed,
        false,
        true,
        this.clock.now(),
      ),
    );
    if (marked === null) {
      throw new MigrationVersionConflictError();
    }
    return this.writeReversal(tx, actor, marked);
  }

  private async writeReversal(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    original: ImportJob,
  ): Promise<ImportJob> {
    const reversal = await this.imports.insert(
      tx,
      buildReversalJob(
        this.ids.generate(),
        original,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildImportAudit(IMPORT_REVERSED_ACTION, actor.userId, reversal),
    );
    return reversal;
  }

  private summaryOf(job: ImportJob): ImportReconciliationSummary {
    return {
      received: job.receivedRows,
      staged: job.stagedRows,
      committed: job.committedRows,
      skippedDuplicate: job.skippedRows,
      error: job.errorRows,
      quarantined: job.quarantinedRows,
    };
  }
}
