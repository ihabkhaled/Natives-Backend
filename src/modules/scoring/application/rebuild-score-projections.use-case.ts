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

import { selectEffectiveRule } from '../domain/rule-selection.policy';
import { CalculationRuleNotFoundError } from '../errors/calculation-rule-not-found.error';
import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import { ScoreProjectionRepository } from '../infrastructure/score-projection.repository';
import { ScoreSourceRepository } from '../infrastructure/score-source.repository';
import {
  buildProjectionRebuiltEvent,
  buildRebuildAudit,
  computeMembershipProjection,
  groupSourcesByMembership,
} from '../lib/scoring.builders';
import { PROJECTION_REBUILT_ACTION } from '../model/scoring.constants';
import type {
  CalculationRule,
  CategorySource,
  ProjectionTarget,
  RebuildOutcome,
} from '../model/scoring.types';
import { ScoringScopeService } from './scoring-scope.service';

/**
 * Rebuilds every active member's performance-score projection from source facts
 * using the team's effective published rule. Idempotent: an upsert per member
 * means a rebuild equals a clean recompute, and a per-member failure is captured
 * without aborting the batch. Superseded projections are pruned and a
 * `scoring.projection.rebuilt` event is emitted — all in one transaction.
 */
@Injectable()
export class RebuildScoreProjectionsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: ScoringScopeService,
    private readonly rules: CalculationRuleRepository,
    private readonly sources: ScoreSourceRepository,
    private readonly projections: ScoreProjectionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(actor: AuthUserIdentity, teamId: string): Promise<RebuildOutcome> {
    return this.unitOfWork.runInTransaction(tx => this.run(tx, actor, teamId));
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<RebuildOutcome> {
    await this.scope.validate(tx, teamId, null);
    const rule = selectEffectiveRule(
      await this.rules.listPublishedForTeam(tx, teamId),
      this.today(),
    );
    if (rule === null) {
      throw new CalculationRuleNotFoundError();
    }
    const outcome = await this.rebuildAll(tx, teamId, rule);
    await this.projections.deleteSupersededForTeam(tx, teamId, rule.ruleId);
    await this.finish(tx, actor, teamId, rule, outcome);
    return outcome;
  }

  private async rebuildAll(
    tx: TransactionScope,
    teamId: string,
    rule: CalculationRule,
  ): Promise<RebuildOutcome> {
    const memberships = await this.sources.listActiveMemberships(tx, teamId);
    const grouped = groupSourcesByMembership(
      await this.sources.categorySourcesForTeam(tx, teamId),
    );
    let rebuilt = 0;
    for (const membership of memberships) {
      const sources = grouped.get(membership.membership_id) ?? [];
      const ok = await this.rebuildOne(
        tx,
        rule,
        teamId,
        membership.membership_id,
        sources,
      );
      rebuilt += ok ? 1 : 0;
    }
    return {
      scanned: memberships.length,
      rebuilt,
      failed: memberships.length - rebuilt,
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
    };
  }

  private async rebuildOne(
    tx: TransactionScope,
    rule: CalculationRule,
    teamId: string,
    membershipId: string,
    sources: readonly CategorySource[],
  ): Promise<boolean> {
    const target = this.target(teamId, membershipId, rule.seasonId);
    try {
      const projection = computeMembershipProjection(
        rule,
        target,
        sources,
        this.clock.now(),
      );
      await this.projections.upsertReady(tx, projection);
      return true;
    } catch (error) {
      await this.projections.upsertFailed(
        tx,
        target,
        rule,
        this.message(error),
        this.clock.now(),
      );
      return false;
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rule: CalculationRule,
    outcome: RebuildOutcome,
  ): Promise<void> {
    await this.audit.record(
      tx,
      buildRebuildAudit(
        PROJECTION_REBUILT_ACTION,
        actor.userId,
        outcome,
        teamId,
        rule.seasonId,
      ),
    );
    await this.events.enqueue(
      tx,
      buildProjectionRebuiltEvent(actor.userId, teamId, rule.seasonId, outcome),
    );
  }

  private target(
    teamId: string,
    membershipId: string,
    seasonId: string | null,
  ): ProjectionTarget {
    return {
      id: this.idGenerator.generate(),
      teamId,
      seasonId,
      membershipId,
      periodId: null,
    };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private today(): string {
    return this.clock.now().toISOString().slice(0, 10);
  }
}
