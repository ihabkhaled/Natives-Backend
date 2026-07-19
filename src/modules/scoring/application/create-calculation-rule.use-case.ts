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

import { assertRuleContent } from '../domain/calculation-rule.policy';
import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import {
  buildNewRule,
  buildRuleAudit,
  buildRuleCreatedEvent,
} from '../lib/scoring.builders';
import { RULE_CREATED_ACTION } from '../model/scoring.constants';
import type {
  CalculationRule,
  CreateRuleCommand,
} from '../model/scoring.types';
import { ScoringScopeService } from './scoring-scope.service';

/**
 * Creates a DRAFT calculation-rule version. Validates the team/season scope and
 * the weighted-component definition, assigns the next version for the rule key,
 * then writes the rule, an audit entry, and a `scoring.rule.created` event in one
 * transaction. A new rule is never active — it must be approved and published.
 */
@Injectable()
export class CreateCalculationRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: ScoringScopeService,
    private readonly repository: CalculationRuleRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateRuleCommand,
  ): Promise<CalculationRule> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateRuleCommand,
  ): Promise<CalculationRule> {
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
    rule: CalculationRule,
  ): Promise<CalculationRule> {
    await this.audit.record(
      tx,
      buildRuleAudit(RULE_CREATED_ACTION, actor.userId, rule),
    );
    await this.events.enqueue(tx, buildRuleCreatedEvent(rule, actor.userId));
    return rule;
  }
}
