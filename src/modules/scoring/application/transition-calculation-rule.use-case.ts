import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
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
  canTransitionRule,
  resolveRuleTarget,
} from '../domain/calculation-rule.state-machine';
import { CalculationRuleInvalidTransitionError } from '../errors/calculation-rule-invalid-transition.error';
import { CalculationRuleVersionConflictError } from '../errors/calculation-rule-version-conflict.error';
import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import { ScoreProjectionRepository } from '../infrastructure/score-projection.repository';
import {
  buildProjectionRequestedEvent,
  buildRuleAudit,
  buildRulePublishedEvent,
  buildRuleRetiredEvent,
  buildStatusChange,
} from '../lib/scoring.builders';
import { RULE_TRANSITIONED_ACTION } from '../model/scoring.constants';
import { CalculationRuleStatus } from '../model/scoring.enums';
import type {
  CalculationRule,
  TransitionRuleCommand,
} from '../model/scoring.types';
import { RuleLookupService } from './rule-lookup.service';

/**
 * Moves a calculation rule through its DRAFT → APPROVED → PUBLISHED → RETIRED
 * lifecycle under an optimistic version guard. Publishing supersedes the prior
 * published version, marks that rule family's projections stale, and enqueues the
 * publish + `scoring.projection.requested` events so projections rebuild
 * asynchronously. All effects commit in one transaction.
 */
@Injectable()
export class TransitionCalculationRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: RuleLookupService,
    private readonly rules: CalculationRuleRepository,
    private readonly projections: ScoreProjectionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    ruleId: string,
    command: TransitionRuleCommand,
  ): Promise<CalculationRule> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, ruleId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    ruleId: string,
    command: TransitionRuleCommand,
  ): Promise<CalculationRule> {
    const existing = await this.lookup.requireForWrite(tx, teamId, ruleId);
    const target = resolveRuleTarget(command.transition);
    if (!canTransitionRule(existing.status, target)) {
      throw new CalculationRuleInvalidTransitionError();
    }
    const changed = await this.rules.applyStatusChange(
      tx,
      buildStatusChange(
        existing,
        teamId,
        target,
        actor.userId,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, teamId, changed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    changed: CalculationRule | null,
  ): Promise<CalculationRule> {
    if (changed === null) {
      throw new CalculationRuleVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildRuleAudit(RULE_TRANSITIONED_ACTION, actor.userId, changed),
    );
    await this.dispatch(tx, actor, teamId, changed);
    return changed;
  }

  private async dispatch(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rule: CalculationRule,
  ): Promise<void> {
    if (rule.status === CalculationRuleStatus.Published) {
      await this.onPublished(tx, actor, teamId, rule);
      return;
    }
    if (rule.status === CalculationRuleStatus.Retired) {
      await this.events.enqueue(tx, buildRuleRetiredEvent(rule, actor.userId));
    }
  }

  private async onPublished(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rule: CalculationRule,
  ): Promise<void> {
    await this.rules.retirePublished(
      tx,
      teamId,
      rule.ruleKey,
      rule.ruleId,
      this.clock.now(),
    );
    await this.projections.markStaleForTeamRuleKey(tx, teamId, rule.ruleKey);
    await this.events.enqueue(tx, buildRulePublishedEvent(rule, actor.userId));
    await this.events.enqueue(
      tx,
      buildProjectionRequestedEvent(rule, actor.userId),
    );
  }
}
