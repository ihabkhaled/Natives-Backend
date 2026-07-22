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

import { evaluateClipWindow } from '../domain/clip-timestamp.policy';
import { ClipDetailRepository } from '../infrastructure/clip-detail.repository';
import { VideoClipRepository } from '../infrastructure/video-clip.repository';
import { buildImportAudit, buildImportedClip } from '../lib/analysis.builders';
import {
  buildImportReport,
  buildRowResult,
} from '../lib/clip-import.reconciler';
import { VIDEO_CLIP_IMPORTED_ACTION } from '../model/analysis.constants';
import { ClipImportOutcome, ClipVisibility } from '../model/analysis.enums';
import type {
  ClipImportReport,
  ClipImportRow,
  ClipImportRowResult,
  ImportVideoClipsCommand,
  VideoSource,
} from '../model/analysis.types';
import { AnalysisLookupService } from './analysis-lookup.service';
import { AnalysisScopeService } from './analysis-scope.service';

/**
 * Imports audited legacy match-analysis rows (UN-505).
 *
 * Three rules make the import safe to re-run and safe to trust: an audited
 * source reference makes it idempotent (a replayed row is reported as a
 * duplicate, never inserted twice); a timestamp outside the known recording is
 * REJECTED and reported rather than clamped; and a player alias that does not
 * resolve to exactly one member of this team rejects its row instead of
 * attaching a coaching note to the wrong person. `dryRun` performs every check
 * and writes nothing, so an operator always sees the reconciliation first.
 */
@Injectable()
export class ImportVideoClipsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: AnalysisLookupService,
    private readonly scopes: AnalysisScopeService,
    private readonly clips: VideoClipRepository,
    private readonly details: ClipDetailRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: ImportVideoClipsCommand,
  ): Promise<ClipImportReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: ImportVideoClipsCommand,
  ): Promise<ClipImportReport> {
    const results: ClipImportRowResult[] = [];
    let seasonId = '';
    for (const row of command.rows) {
      const source = await this.lookup.requireSource(tx, teamId, row.sourceId);
      seasonId = source.seasonId;
      results.push(
        await this.importRow(tx, actor, teamId, source, row, command.dryRun),
      );
    }
    const report = buildImportReport(
      command.dryRun,
      command.rows.length,
      results,
    );
    await this.recordAudit(tx, actor, teamId, seasonId, report);
    return report;
  }

  private async importRow(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    source: VideoSource,
    row: ClipImportRow,
    dryRun: boolean,
  ): Promise<ClipImportRowResult> {
    const existing = await this.clips.findByImportReference(
      tx,
      teamId,
      row.reference,
    );
    if (existing !== null) {
      return buildRowResult(
        row.reference,
        ClipImportOutcome.SkippedDuplicate,
        existing.clipId,
      );
    }
    const verdict = evaluateClipWindow(row, source.durationSeconds);
    if (!verdict.valid) {
      return buildRowResult(
        row.reference,
        ClipImportOutcome.RejectedTimestamp,
        null,
      );
    }
    return this.resolveAndWrite(tx, actor, teamId, source, row, dryRun);
  }

  private async resolveAndWrite(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    source: VideoSource,
    row: ClipImportRow,
    dryRun: boolean,
  ): Promise<ClipImportRowResult> {
    const memberships = await this.resolveAliases(tx, teamId, row);
    if (memberships === null) {
      return buildRowResult(
        row.reference,
        ClipImportOutcome.RejectedAlias,
        null,
      );
    }
    if (dryRun) {
      return buildRowResult(row.reference, ClipImportOutcome.Imported, null);
    }
    const clipId = await this.write(tx, actor, source, row, memberships);
    return buildRowResult(row.reference, ClipImportOutcome.Imported, clipId);
  }

  /** Every alias must resolve; one unresolved alias rejects the whole row. */
  private async resolveAliases(
    tx: TransactionScope,
    teamId: string,
    row: ClipImportRow,
  ): Promise<readonly string[] | null> {
    const resolved: string[] = [];
    for (const alias of row.playerAliases) {
      const membershipId = await this.scopes.resolveAliasMembership(
        tx,
        teamId,
        alias,
      );
      if (membershipId === null) {
        return null;
      }
      resolved.push(membershipId);
    }
    return resolved;
  }

  private async write(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    source: VideoSource,
    row: ClipImportRow,
    memberships: readonly string[],
  ): Promise<string> {
    const now = this.clock.now();
    const clip = await this.clips.insert(
      tx,
      buildImportedClip(
        this.ids.generate(),
        source,
        {
          sourceId: source.sourceId,
          pointId: null,
          eventId: null,
          startSecond: row.startSecond,
          endSecond: row.endSecond,
          playContext: row.playContext,
          clipType: row.clipType,
          title: row.title,
          comment: row.comment,
          visibility: ClipVisibility.CoachOnly,
          membershipIds: memberships,
          tags: row.tags,
        },
        row.reference,
        actor.userId,
        now,
      ),
    );
    await this.details.replacePlayers(tx, clip.clipId, memberships, now);
    await this.details.replaceTags(tx, clip.clipId, row.tags, now);
    return clip.clipId;
  }

  private async recordAudit(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
    report: ClipImportReport,
  ): Promise<void> {
    if (seasonId === '') {
      return;
    }
    await this.audit.record(
      tx,
      buildImportAudit(
        VIDEO_CLIP_IMPORTED_ACTION,
        actor.userId,
        teamId,
        seasonId,
        report,
      ),
    );
  }
}
