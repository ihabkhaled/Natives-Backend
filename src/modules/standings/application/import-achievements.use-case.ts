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

import { AchievementRepository } from '../infrastructure/achievement.repository';
import {
  buildAchievementImportReport,
  buildAchievementRowResult,
  isImportableRow,
} from '../lib/achievement-import.reconciler';
import {
  buildAchievementImportAudit,
  buildImportedAchievement,
} from '../lib/standings.builders';
import { AchievementImportOutcome } from '../model/standings.enums';
import type {
  AchievementImportReport,
  AchievementImportRow,
  AchievementImportRowResult,
  ImportAchievementsCommand,
} from '../model/standings.types';

/**
 * Imports audited historical achievements (UN-506).
 *
 * A spreadsheet cell is never taken as truth: a row whose title still carries a
 * broken formula result or whose date is not a real calendar day is REJECTED and
 * reported. The audited source reference makes the run idempotent — replaying it
 * reports duplicates instead of doubling the trophy cabinet — and every imported
 * row lands as a DRAFT that still needs human approval before it becomes
 * history. `dryRun` performs every check and writes nothing.
 */
@Injectable()
export class ImportAchievementsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly achievements: AchievementRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: ImportAchievementsCommand,
  ): Promise<AchievementImportReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: ImportAchievementsCommand,
  ): Promise<AchievementImportReport> {
    const results: AchievementImportRowResult[] = [];
    for (const row of command.rows) {
      results.push(
        await this.importRow(tx, actor, teamId, row, command.dryRun),
      );
    }
    const report = buildAchievementImportReport(
      command.dryRun,
      command.rows.length,
      results,
    );
    await this.audit.record(
      tx,
      buildAchievementImportAudit(actor.userId, teamId, report),
    );
    return report;
  }

  private async importRow(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    row: AchievementImportRow,
    dryRun: boolean,
  ): Promise<AchievementImportRowResult> {
    const existing = await this.achievements.findByImportReference(
      tx,
      teamId,
      row.reference,
    );
    if (existing !== null) {
      return buildAchievementRowResult(
        row.reference,
        AchievementImportOutcome.SkippedDuplicate,
        existing.achievementId,
      );
    }
    if (!isImportableRow(row)) {
      return buildAchievementRowResult(
        row.reference,
        AchievementImportOutcome.RejectedInvalid,
        null,
      );
    }
    return this.write(tx, actor, teamId, row, dryRun);
  }

  private async write(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    row: AchievementImportRow,
    dryRun: boolean,
  ): Promise<AchievementImportRowResult> {
    if (dryRun) {
      return buildAchievementRowResult(
        row.reference,
        AchievementImportOutcome.Imported,
        null,
      );
    }
    const created = await this.achievements.insert(
      tx,
      buildImportedAchievement(
        this.ids.generate(),
        teamId,
        row,
        actor.userId,
        this.clock.now(),
      ),
    );
    return buildAchievementRowResult(
      row.reference,
      AchievementImportOutcome.Imported,
      created.achievementId,
    );
  }
}
