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
  measureAttendance,
  measurePoints,
} from '../domain/analytics-computation.policy';
import { AnalyticsFactRepository } from '../infrastructure/analytics-fact.repository';
import { ProjectionRepository } from '../infrastructure/projection.repository';
import {
  buildPlayerProjection,
  buildRebuildAudit,
} from '../lib/analytics.builders';
import { CALCULATION_VERSION } from '../model/analytics.constants';
import { AnalyticsDimension } from '../model/analytics.enums';
import type {
  AnalyticsScope,
  AttendanceFact,
  PointsFact,
  RebuildCommand,
  RebuildReport,
} from '../model/analytics.types';
import { AnalyticsScopeService } from './analytics-scope.service';

/**
 * Idempotently rebuilds the analytics read model from facts (UN-700).
 *
 * The rebuild is a pure fold over source facts written through an upsert, so
 * running it once or ten times converges on the same projections — never
 * duplicates. Null-not-zero is preserved end to end: a member with no recorded
 * attendance in a period gets a NULL attendance projection (a gap), while a
 * member who was recorded but attended none gets a real 0. Every zero-
 * contribution member on the roster is still projected, so completeness counts
 * the members who did nothing.
 */
@Injectable()
export class RebuildAnalyticsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly scopes: AnalyticsScopeService,
    private readonly facts: AnalyticsFactRepository,
    private readonly projections: ProjectionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: RebuildCommand,
  ): Promise<RebuildReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: RebuildCommand,
  ): Promise<RebuildReport> {
    await this.scopes.requireTeam(tx, teamId);
    const scope: AnalyticsScope = { teamId, seasonId: command.seasonId };
    const roster = await this.facts.listRoster(tx, teamId, command.seasonId);
    const attendance = await this.facts.listAttendanceFacts(
      tx,
      teamId,
      command.seasonId,
    );
    const points = await this.facts.listPointsFacts(
      tx,
      teamId,
      command.seasonId,
    );
    const written = await this.projectRoster(
      tx,
      scope,
      command,
      roster,
      attendance,
      points,
    );
    return this.finish(tx, actor, scope, command, roster.length, written);
  }

  private async projectRoster(
    tx: TransactionScope,
    scope: AnalyticsScope,
    command: RebuildCommand,
    roster: readonly string[],
    attendance: readonly AttendanceFact[],
    points: readonly PointsFact[],
  ): Promise<number> {
    let written = 0;
    for (const membershipId of roster) {
      written += await this.projectMember(
        tx,
        scope,
        command,
        membershipId,
        attendance,
        points,
      );
    }
    return written;
  }

  private async projectMember(
    tx: TransactionScope,
    scope: AnalyticsScope,
    command: RebuildCommand,
    membershipId: string,
    attendance: readonly AttendanceFact[],
    points: readonly PointsFact[],
  ): Promise<number> {
    const own = attendance.filter(fact => fact.membershipId === membershipId);
    const ownPoints = points.filter(fact => fact.membershipId === membershipId);
    let written = 0;
    for (const fact of own) {
      await this.upsertAttendance(tx, scope, command, membershipId, fact);
      written += 1;
    }
    for (const fact of ownPoints) {
      await this.upsertPoints(tx, scope, command, membershipId, fact);
      written += 1;
    }
    return written;
  }

  private async upsertAttendance(
    tx: TransactionScope,
    scope: AnalyticsScope,
    command: RebuildCommand,
    membershipId: string,
    fact: AttendanceFact,
  ): Promise<void> {
    const measure = measureAttendance(fact);
    await this.projections.upsert(
      tx,
      buildPlayerProjection(
        this.ids.generate(),
        scope,
        membershipId,
        AnalyticsDimension.Attendance,
        command.periodType,
        measure.periodKey,
        measure.ratio,
        measure.sampleSize,
        { attendance: measure.sampleSize },
        this.clock.now(),
      ),
    );
  }

  private async upsertPoints(
    tx: TransactionScope,
    scope: AnalyticsScope,
    command: RebuildCommand,
    membershipId: string,
    fact: PointsFact,
  ): Promise<void> {
    await this.projections.upsert(
      tx,
      buildPlayerProjection(
        this.ids.generate(),
        scope,
        membershipId,
        AnalyticsDimension.Points,
        command.periodType,
        fact.periodKey,
        measurePoints(fact),
        1,
        { points: 1 },
        this.clock.now(),
      ),
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    scope: AnalyticsScope,
    command: RebuildCommand,
    subjectsProjected: number,
    projectionsWritten: number,
  ): Promise<RebuildReport> {
    const report: RebuildReport = {
      seasonId: command.seasonId,
      periodType: command.periodType,
      calculationVersion: CALCULATION_VERSION,
      subjectsProjected,
      projectionsWritten,
      computedAt: this.clock.now(),
    };
    await this.audit.record(tx, buildRebuildAudit(actor.userId, scope, report));
    return report;
  }
}
