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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  foldResults,
  mirrorTally,
  scoreTally,
} from '../domain/standings-computation.policy';
import { StandingRepository } from '../infrastructure/standing.repository';
import {
  buildDerivedStanding,
  buildRecomputeAudit,
  buildStandingsRecomputedEvent,
} from '../lib/standings.builders';
import { STANDINGS_RECOMPUTED_ACTION } from '../model/standings.constants';
import { StandingEntrantKind } from '../model/standings.enums';
import type {
  CompetitionStanding,
  FinalizedMatchResult,
  RecomputeStandingsCommand,
  StandingsRecomputeReport,
  StandingsRuleVersion,
  StandingsScope,
} from '../model/standings.types';
import { StandingsRuleService } from './standings-rule.service';
import { StandingsScopeService } from './standings-scope.service';

/**
 * Derives a competition's standings from its FINALIZED matches (UN-506).
 *
 * The fold is pure and idempotent: only finalized matches contribute, the named
 * rule version decides the points, and the upsert converges on the same table
 * however often it is re-run. Opponent rows are the mirror of our own results
 * re-scored under the same version, so both sides of a table always agree. A
 * manually reconciled row is a separate, permissioned write — this use case
 * never invents or overrides one.
 */
@Injectable()
export class RecomputeStandingsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly scopes: StandingsScopeService,
    private readonly rules: StandingsRuleService,
    private readonly standings: StandingRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: RecomputeStandingsCommand,
  ): Promise<StandingsRecomputeReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: RecomputeStandingsCommand,
  ): Promise<StandingsRecomputeReport> {
    const scope = await this.scopes.forCompetition(
      tx,
      teamId,
      command.competitionId,
    );
    const rule = await this.rules.require(tx, teamId, command.ruleKey);
    const results = await this.scopes.listFinalizedResults(
      tx,
      teamId,
      command.competitionId,
    );
    const rows = await this.writeRows(tx, actor, scope, rule, results);
    return this.finish(tx, actor, scope, rule, results, rows);
  }

  private async writeRows(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    scope: StandingsScope,
    rule: StandingsRuleVersion,
    results: readonly FinalizedMatchResult[],
  ): Promise<readonly CompetitionStanding[]> {
    const now = this.clock.now();
    const rows: CompetitionStanding[] = [
      await this.standings.upsert(
        tx,
        buildDerivedStanding(
          this.ids.generate(),
          scope,
          rule,
          null,
          StandingEntrantKind.Team,
          null,
          foldResults(results, rule),
          actor.userId,
          now,
        ),
      ),
    ];
    for (const opponentId of this.opponentsOf(results)) {
      rows.push(
        await this.writeOpponent(
          tx,
          actor,
          scope,
          rule,
          results,
          opponentId,
          now,
        ),
      );
    }
    return rows;
  }

  private writeOpponent(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    scope: StandingsScope,
    rule: StandingsRuleVersion,
    results: readonly FinalizedMatchResult[],
    opponentId: string,
    now: Date,
  ): Promise<CompetitionStanding> {
    const own = results.filter(result => result.opponentId === opponentId);
    return this.standings.upsert(
      tx,
      buildDerivedStanding(
        this.ids.generate(),
        scope,
        rule,
        null,
        StandingEntrantKind.Opponent,
        opponentId,
        scoreTally(mirrorTally(foldResults(own, rule)), rule),
        actor.userId,
        now,
      ),
    );
  }

  private opponentsOf(
    results: readonly FinalizedMatchResult[],
  ): readonly string[] {
    const ids = results
      .map(result => result.opponentId)
      .filter((id): id is string => id !== null);
    return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    scope: StandingsScope,
    rule: StandingsRuleVersion,
    results: readonly FinalizedMatchResult[],
    rows: readonly CompetitionStanding[],
  ): Promise<StandingsRecomputeReport> {
    const report: StandingsRecomputeReport = {
      competitionId: scope.competitionId,
      ruleVersionId: rule.ruleVersionId,
      finalizedMatches: results.length,
      entrants: rows.length,
      rows,
    };
    await this.audit.record(
      tx,
      buildRecomputeAudit(
        STANDINGS_RECOMPUTED_ACTION,
        actor.userId,
        scope,
        report,
      ),
    );
    await this.events.enqueue(
      tx,
      buildStandingsRecomputedEvent(scope, report, actor.userId),
    );
    return report;
  }
}
