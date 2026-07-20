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

import { MatchRulesetNotFoundError } from '../errors/match-ruleset-not-found.error';
import { MatchRepository } from '../infrastructure/match.repository';
import { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import { buildMatchAudit, buildNewMatch } from '../lib/matches.builders';
import { MATCH_CREATED_ACTION } from '../model/matches.constants';
import { RulesetStatus } from '../model/matches.enums';
import type {
  CreateMatchCommand,
  Match,
  MatchRuleset,
} from '../model/matches.types';
import { MatchScopeService } from './match-scope.service';

/**
 * Creates the authoritative match record for a fixture (match.manage). The match
 * adopts an ACTIVE ruleset version by id (or the team's default active one) and
 * pins it for life, so its caps and targets never change under it retroactively.
 * A partial-unique index allows only one non-abandoned match per fixture — the
 * "only one authoritative stream per match" invariant, enforced by the database.
 */
@Injectable()
export class CreateMatchUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: MatchScopeService,
    private readonly rulesets: MatchRulesetRepository,
    private readonly matches: MatchRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchCommand,
  ): Promise<Match> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchCommand,
  ): Promise<Match> {
    const resolved = await this.scope.forFixture(
      tx,
      teamId,
      command.content.fixtureId,
      command.content.rosterId,
    );
    const ruleset = await this.requireRuleset(tx, teamId, command);
    const match = await this.matches.insert(
      tx,
      buildNewMatch(
        this.idGenerator.generate(),
        teamId,
        resolved,
        command.content.fixtureId,
        command.content.rosterId,
        ruleset.rulesetId,
        command.content.notes,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, match);
  }

  private async requireRuleset(
    tx: TransactionScope,
    teamId: string,
    command: CreateMatchCommand,
  ): Promise<MatchRuleset> {
    const ruleset = await this.resolveRuleset(tx, teamId, command);
    if (ruleset?.status !== RulesetStatus.Active) {
      throw new MatchRulesetNotFoundError();
    }
    return ruleset;
  }

  private resolveRuleset(
    tx: TransactionScope,
    teamId: string,
    command: CreateMatchCommand,
  ): Promise<MatchRuleset | null> {
    const requested = command.content.rulesetId;
    if (requested === null) {
      return this.rulesets.findDefaultActive(tx, teamId);
    }
    return this.rulesets.findById(tx, teamId, requested);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
  ): Promise<Match> {
    await this.audit.record(
      tx,
      buildMatchAudit(MATCH_CREATED_ACTION, actor.userId, match),
    );
    return match;
  }
}
