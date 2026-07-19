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

import { assertRuleContent } from '../domain/points-rule.policy';
import { PointsRuleRepository } from '../infrastructure/points-rule.repository';
import {
  buildNewRule,
  buildRuleAudit,
  buildRuleCreatedEvent,
} from '../lib/points.builders';
import { RULE_CREATED_ACTION } from '../model/points.constants';
import type { CreateRuleCommand, PointsRule } from '../model/points.types';
import { PointsScopeService } from './points-scope.service';

/**
 * Creates a DRAFT points-rule version. Validates the team/season scope and the
 * per-category value set, assigns the next version for the rule key, then writes
 * the rule, an audit entry, and a `points.rule.created` event in one transaction.
 * A new rule is never effective — it must be approved and published.
 */
@Injectable()
export class CreatePointsRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: PointsScopeService,
    private readonly repository: PointsRuleRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateRuleCommand,
  ): Promise<PointsRule> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateRuleCommand,
  ): Promise<PointsRule> {
    await this.scope.validate(tx, teamId, command.content.seasonId);
    assertRuleContent(command.content);
    const version = await this.repository.nextVersion(
      tx,
      teamId,
      command.content.ruleKey,
    );
    const rule = await this.repository.insert(
      tx,
      buildNewRule(
        this.idGenerator.generate(),
        teamId,
        version,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, rule);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    rule: PointsRule,
  ): Promise<PointsRule> {
    await this.audit.record(
      tx,
      buildRuleAudit(RULE_CREATED_ACTION, actor.userId, rule),
    );
    await this.events.enqueue(tx, buildRuleCreatedEvent(rule, actor.userId));
    return rule;
  }
}
