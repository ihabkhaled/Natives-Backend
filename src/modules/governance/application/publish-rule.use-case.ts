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

import { RuleRepository } from '../infrastructure/rule.repository';
import {
  buildNewRule,
  buildRuleAudit,
  buildRulePublishedEvent,
} from '../lib/governance.builders';
import { FIRST_RULE_VERSION } from '../model/governance.constants';
import type { PublishRuleCommand, TeamRule } from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Publishes the next version of a named team rule (UN-602). A rule is never
 * edited: correcting the text publishes version N+1, and an acknowledgement
 * always cites the version it accepted. Publishing enqueues
 * `governance.rule.published` so members can be prompted to re-acknowledge.
 */
@Injectable()
export class PublishRuleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: GovernanceLookupService,
    private readonly rules: RuleRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: PublishRuleCommand,
  ): Promise<TeamRule> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: PublishRuleCommand,
  ): Promise<TeamRule> {
    await this.lookup.requireTeam(tx, teamId);
    const latest = await this.rules.findLatestByKey(
      tx,
      teamId,
      command.content.ruleKey,
    );
    const version = latest === null ? FIRST_RULE_VERSION : latest.version + 1;
    const rule = await this.rules.insert(
      tx,
      buildNewRule(
        this.ids.generate(),
        teamId,
        command.content,
        version,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(tx, buildRuleAudit(actor.userId, rule));
    await this.events.enqueue(tx, buildRulePublishedEvent(rule, actor.userId));
    return rule;
  }
}
