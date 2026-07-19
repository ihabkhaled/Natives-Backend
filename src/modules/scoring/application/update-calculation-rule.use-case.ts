import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertRuleContent } from '../domain/calculation-rule.policy';
import { isRuleEditable } from '../domain/calculation-rule.state-machine';
import { CalculationRuleNotEditableError } from '../errors/calculation-rule-not-editable.error';
import { CalculationRuleVersionConflictError } from '../errors/calculation-rule-version-conflict.error';
import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import { buildRuleAudit } from '../lib/scoring.builders';
import { RULE_UPDATED_ACTION } from '../model/scoring.constants';
import type {
  CalculationRule,
  UpdateRuleCommand,
} from '../model/scoring.types';
import { RuleLookupService } from './rule-lookup.service';

/**
 * Edits the content of a DRAFT calculation rule under an optimistic version
 * guard. Approved, published, and retired rules are immutable — a change to them
 * is a new version, never an in-place edit. Writes the update and an audit entry
 * in one transaction.
 */
@Injectable()
export class UpdateCalculationRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: RuleLookupService,
    private readonly repository: CalculationRuleRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    ruleId: string,
    command: UpdateRuleCommand,
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
    command: UpdateRuleCommand,
  ): Promise<CalculationRule> {
    const existing = await this.lookup.requireForWrite(tx, teamId, ruleId);
    if (!isRuleEditable(existing.status)) {
      throw new CalculationRuleNotEditableError();
    }
    assertRuleContent(command.content);
    const updated = await this.repository.updateContent(tx, {
      id: ruleId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      content: command.content,
      now: this.clock.now(),
    });
    return this.finish(tx, actor, updated);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    updated: CalculationRule | null,
  ): Promise<CalculationRule> {
    if (updated === null) {
      throw new CalculationRuleVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildRuleAudit(RULE_UPDATED_ACTION, actor.userId, updated),
    );
    return updated;
  }
}
