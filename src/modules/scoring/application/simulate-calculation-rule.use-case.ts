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
import { Inject, Injectable } from '@nestjs/common';

import { selectEffectiveRule } from '../domain/rule-selection.policy';
import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import { ScoreSourceRepository } from '../infrastructure/score-source.repository';
import {
  computeMembershipProjection,
  groupSourcesByMembership,
} from '../lib/scoring.builders';
import type {
  CalculationRule,
  CategorySource,
  ScoreExplanation,
  SimulateRuleCommand,
  SimulationComparison,
} from '../model/scoring.types';
import { RuleLookupService } from './rule-lookup.service';
import { ScoringScopeService } from './scoring-scope.service';

/**
 * Dry-runs a calculation rule against one member's live source facts and compares
 * it to the effective published rule — WRITES NOTHING (no projection, audit, or
 * event). Lets an administrator preview a draft rule's effect before activation.
 * The read transaction commits with no mutations.
 */
@Injectable()
export class SimulateCalculationRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: ScoringScopeService,
    private readonly lookup: RuleLookupService,
    private readonly rules: CalculationRuleRepository,
    private readonly sources: ScoreSourceRepository,
  ) {}

  execute(
    teamId: string,
    ruleId: string,
    command: SimulateRuleCommand,
  ): Promise<SimulationComparison> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, teamId, ruleId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    teamId: string,
    ruleId: string,
    command: SimulateRuleCommand,
  ): Promise<SimulationComparison> {
    const rule = await this.lookup.requireForWrite(tx, teamId, ruleId);
    await this.scope.requireMembership(tx, teamId, command.membershipId);
    const sources = await this.loadSources(tx, teamId, command.membershipId);
    const draft = this.explain(rule, teamId, command.membershipId, sources);
    const published = await this.publishedExplanation(
      tx,
      teamId,
      command.membershipId,
      sources,
    );
    return {
      membershipId: command.membershipId,
      draft,
      published,
      delta: this.delta(draft, published),
    };
  }

  private async loadSources(
    tx: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly CategorySource[]> {
    const rows = await this.sources.categorySourcesForMembership(
      tx,
      teamId,
      membershipId,
    );
    return groupSourcesByMembership(rows).get(membershipId) ?? [];
  }

  private async publishedExplanation(
    tx: TransactionScope,
    teamId: string,
    membershipId: string,
    sources: readonly CategorySource[],
  ): Promise<ScoreExplanation | null> {
    const published = selectEffectiveRule(
      await this.rules.listPublishedForTeam(tx, teamId),
      this.today(),
    );
    if (published === null) {
      return null;
    }
    return this.explain(published, teamId, membershipId, sources);
  }

  private explain(
    rule: CalculationRule,
    teamId: string,
    membershipId: string,
    sources: readonly CategorySource[],
  ): ScoreExplanation {
    return computeMembershipProjection(
      rule,
      {
        id: this.idGenerator.generate(),
        teamId,
        seasonId: rule.seasonId,
        membershipId,
        periodId: null,
      },
      sources,
      this.clock.now(),
    ).explanation;
  }

  private delta(
    draft: ScoreExplanation,
    published: ScoreExplanation | null,
  ): number | null {
    if (published === null) {
      return null;
    }
    if (
      draft.overall.unrounded === null ||
      published.overall.unrounded === null
    ) {
      return null;
    }
    return draft.overall.unrounded - published.overall.unrounded;
  }

  private today(): string {
    return this.clock.now().toISOString().slice(0, 10);
  }
}
