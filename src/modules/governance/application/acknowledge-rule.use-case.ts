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

import { RuleAcknowledgementForbiddenError } from '../errors/rule-acknowledgement-forbidden.error';
import { RuleRepository } from '../infrastructure/rule.repository';
import {
  buildAcknowledgement,
  buildAcknowledgementAudit,
} from '../lib/governance.builders';
import { RULE_ACKNOWLEDGED_ACTION } from '../model/governance.constants';
import type { RuleAcknowledgement } from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Records a member's acknowledgement of one rule VERSION (UN-602). The
 * acknowledgement always cites the version accepted, so publishing a new version
 * legitimately leaves earlier acknowledgements stale — a member must accept the
 * current text again. Upserted, so a repeat is idempotent.
 *
 * Self-scope is enforced (BE-3): the membership must belong to the acting user.
 * Acknowledging on another member's behalf is a typed 403
 * (errors.governance.acknowledgementForbidden), never a silent proxy write.
 */
@Injectable()
export class AcknowledgeRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: GovernanceLookupService,
    private readonly rules: RuleRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    ruleId: string,
    membershipId: string,
  ): Promise<RuleAcknowledgement> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, ruleId, membershipId),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    ruleId: string,
    membershipId: string,
  ): Promise<RuleAcknowledgement> {
    const rule = await this.lookup.requireRule(tx, teamId, ruleId);
    await this.requireOwnMembership(tx, actor, teamId, membershipId);
    const ack = await this.rules.upsertAcknowledgement(
      tx,
      buildAcknowledgement(
        this.ids.generate(),
        rule,
        membershipId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildAcknowledgementAudit(
        RULE_ACKNOWLEDGED_ACTION,
        actor.userId,
        rule,
        membershipId,
      ),
    );
    return ack;
  }

  /** The membership must resolve to the acting user — never a third party. */
  private async requireOwnMembership(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    const membership = await this.lookup.requireMembershipRef(
      tx,
      teamId,
      membershipId,
    );
    if (membership.userId !== actor.userId) {
      throw new RuleAcknowledgementForbiddenError();
    }
  }
}
