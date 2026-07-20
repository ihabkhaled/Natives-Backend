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

import { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import {
  buildNewMatchRuleset,
  buildRulesetAudit,
} from '../lib/matches.builders';
import type {
  CreateMatchRulesetCommand,
  MatchRuleset,
} from '../model/matches.types';
import { MatchScopeService } from './match-scope.service';

/**
 * Publishes a new VERSION of a named scoring rule set (match.manage). Existing
 * versions are never edited: the previously active version of the key is
 * archived and the new one becomes active, so every match that already cited an
 * older version stays explainable under exactly the rules it was played under.
 * All effects commit in one transaction.
 */
@Injectable()
export class CreateMatchRulesetUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: MatchScopeService,
    private readonly rulesets: MatchRulesetRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchRulesetCommand,
  ): Promise<MatchRuleset> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchRulesetCommand,
  ): Promise<MatchRuleset> {
    await this.scope.requireSeason(tx, teamId, command.content.seasonId);
    const now = this.clock.now();
    await this.rulesets.archiveActive(
      tx,
      teamId,
      command.content.rulesetKey,
      now,
    );
    return this.publish(tx, actor, teamId, command, now);
  }

  private async publish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchRulesetCommand,
    now: Date,
  ): Promise<MatchRuleset> {
    const version = await this.rulesets.nextVersion(
      tx,
      teamId,
      command.content.rulesetKey,
    );
    const ruleset = await this.rulesets.insert(
      tx,
      buildNewMatchRuleset(
        this.idGenerator.generate(),
        teamId,
        command.content,
        version,
        actor.userId,
        now,
      ),
    );
    await this.audit.record(tx, buildRulesetAudit(actor.userId, ruleset));
    return ruleset;
  }
}
