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

import { ImportJobRepository } from '../infrastructure/import-job.repository';
import { reconcile } from '../lib/import-reconciler';
import {
  buildNewImportJob,
  buildReconciliation,
  buildRowResult,
  buildStagedAudit,
} from '../lib/migration.builders';
import { sourceHash } from '../lib/migration.helpers';
import { MAPPER_VERSION } from '../model/migration.constants';
import { ImportStatus } from '../model/migration.enums';
import type {
  ImportJob,
  NewRowResult,
  ParsedRow,
  StageImportCommand,
} from '../model/migration.types';
import { MigrationLookupService } from './migration-lookup.service';
import { RowParserService } from './row-parser.service';

/**
 * Stages an audited workbook — always as a DRY RUN first (UN-702).
 *
 * Every import begins here: the source is hashed (the file is never stored), the
 * rows are parsed and reconciled, and the per-row results are written. A dry run
 * writes NOTHING to the domain — only the job and its reconciliation — so an
 * operator always sees the outcome (staged / skipped / error / quarantined)
 * before any commit. Re-staging the same committed source replays to the prior
 * job rather than re-importing, which is the idempotency retries rely on.
 */
@Injectable()
export class StageImportUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: MigrationLookupService,
    private readonly imports: ImportJobRepository,
    private readonly parser: RowParserService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: StageImportCommand,
  ): Promise<ImportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: StageImportCommand,
  ): Promise<ImportJob> {
    await this.lookup.requireTeam(tx, teamId);
    const hash = sourceHash(command.rows);
    const existing = await this.imports.findCommittedBySource(
      tx,
      teamId,
      hash,
      MAPPER_VERSION,
    );
    if (existing !== null) {
      return existing;
    }
    return this.stage(tx, actor, teamId, command, hash);
  }

  private async stage(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: StageImportCommand,
    hash: string,
  ): Promise<ImportJob> {
    const job = await this.imports.insert(
      tx,
      buildNewImportJob(
        this.ids.generate(),
        teamId,
        command,
        hash,
        actor.userId,
        this.clock.now(),
      ),
    );
    const parsed = this.parser.parse(command.rows);
    await this.writeResults(tx, teamId, job.jobId, parsed);
    const reconciled = await this.reconcileJob(tx, job, parsed);
    await this.audit.record(tx, buildStagedAudit(actor.userId, reconciled));
    return reconciled;
  }

  private async writeResults(
    tx: TransactionScope,
    teamId: string,
    jobId: string,
    parsed: readonly ParsedRow[],
  ): Promise<void> {
    const results: NewRowResult[] = parsed.map(row =>
      buildRowResult(this.ids.generate(), teamId, jobId, row, this.clock.now()),
    );
    await this.imports.insertRowResults(tx, results);
  }

  private async reconcileJob(
    tx: TransactionScope,
    job: ImportJob,
    parsed: readonly ParsedRow[],
  ): Promise<ImportJob> {
    const summary = reconcile(parsed);
    const status =
      summary.error > 0 ? ImportStatus.Staged : ImportStatus.Validated;
    const reconciled = await this.imports.reconcile(
      tx,
      buildReconciliation(job, summary, status, false, false, this.clock.now()),
    );
    return reconciled ?? job;
  }
}
