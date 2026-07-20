import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import { MatchRulesetNotFoundError } from '../errors/match-ruleset-not-found.error';
import { MatchRepository } from '../infrastructure/match.repository';
import { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import type { Match, MatchRuleset } from '../model/matches.types';

/**
 * Resolves a team-owned match (and the versioned ruleset it is played under) for
 * a write or a scoped read, translating a miss into a 404 that hides existence.
 * Only the team's own matches are reachable — a cross-team id resolves to
 * not-found, never a leak.
 */
@Injectable()
export class MatchLookupService {
  constructor(
    private readonly matches: MatchRepository,
    private readonly rulesets: MatchRulesetRepository,
  ) {}

  async require(
    scope: TransactionScope,
    teamId: string,
    matchId: string,
  ): Promise<Match> {
    const match = await this.matches.findForWrite(scope, teamId, matchId);
    if (match === null) {
      throw new MatchNotFoundError();
    }
    return match;
  }

  async requireRuleset(
    scope: TransactionScope,
    teamId: string,
    rulesetId: string,
  ): Promise<MatchRuleset> {
    const ruleset = await this.rulesets.findById(scope, teamId, rulesetId);
    if (ruleset === null) {
      throw new MatchRulesetNotFoundError();
    }
    return ruleset;
  }
}
