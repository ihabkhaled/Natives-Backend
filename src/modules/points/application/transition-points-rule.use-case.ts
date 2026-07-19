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
} from '../domain/points-rule.state-machine';
import { PointsRuleInvalidTransitionError } from '../errors/points-rule-invalid-transition.error';
import { PointsRuleVersionConflictError } from '../errors/points-rule-version-conflict.error';
import { PointsRuleRepository } from '../infrastructure/points-rule.repository';
import {
  buildRuleAudit,
  buildRulePublishedEvent,
  buildRuleRetiredEvent,
  buildRuleStatusChange,
} from '../lib/points.builders';
import { RULE_TRANSITIONED_ACTION } from '../model/points.constants';
import { PointsRuleStatus } from '../model/points.enums';
import type { PointsRule, TransitionRuleCommand } from '../model/points.types';
import { RuleLookupService } from './rule-lookup.service';

/**
 * Moves a points rule through its DRAFT → APPROVED → PUBLISHED → RETIRED lifecycle
 * under an optimistic version guard. Publishing supersedes the prior published
 * version of the same rule key (retired atomically) so at most one value set is
 * ever effective, and enqueues the publish/retire events. All effects commit in
 * one transaction; a published or retired rule is never edited in place.
 */
@Injectable()
export class TransitionPointsRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: RuleLookupService,
    private readonly rules: PointsRuleRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    ruleId: string,
    command: TransitionRuleCommand,
  ): Promise<PointsRule> {
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
  ): Promise<PointsRule> {
    const existing = await this.lookup.requireForWrite(tx, teamId, ruleId);
    const target = resolveRuleTarget(command.transition);
    if (!canTransitionRule(existing.status, target)) {
      throw new PointsRuleInvalidTransitionError();
    }
    const changed = await this.rules.applyStatusChange(
      tx,
      buildRuleStatusChange(
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
    changed: PointsRule | null,
  ): Promise<PointsRule> {
    if (changed === null) {
      throw new PointsRuleVersionConflictError();
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
    rule: PointsRule,
  ): Promise<void> {
    if (rule.status === PointsRuleStatus.Published) {
      await this.onPublished(tx, actor, teamId, rule);
      return;
    }
    if (rule.status === PointsRuleStatus.Retired) {
      await this.events.enqueue(tx, buildRuleRetiredEvent(rule, actor.userId));
    }
  }

  private async onPublished(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rule: PointsRule,
  ): Promise<void> {
    await this.rules.retirePublished(
      tx,
      teamId,
      rule.ruleKey,
      rule.ruleId,
      this.clock.now(),
    );
    await this.events.enqueue(tx, buildRulePublishedEvent(rule, actor.userId));
  }
}
