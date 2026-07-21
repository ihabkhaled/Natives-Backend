import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { deriveMatchStatistics } from '../domain/match-statistics.policy';
import { MatchPlayEventRepository } from '../infrastructure/match-play-event.repository';
import { MatchPointLineupRepository } from '../infrastructure/match-point-lineup.repository';
import { MatchRosterRepository } from '../infrastructure/match-roster.repository';
import type {
  Match,
  MatchRuleset,
  MatchStatistics,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Derives the match statistics projection (match.stats.read). NOTHING here is
 * stored: every read re-folds the append-only stream, the lineups attached to
 * it, the match roster, and the VERSIONED ruleset through the pure engine, so a
 * displayed figure is always explainable and can never drift from its sources.
 *
 * Because the same pure engine serves the read and the rebuild, a rebuild is
 * provably identical to a clean replay — there is only one code path.
 */
@Injectable()
export class MatchStatisticsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MatchLookupService,
    private readonly plays: MatchPlayEventRepository,
    private readonly lineups: MatchPointLineupRepository,
    private readonly roster: MatchRosterRepository,
  ) {}

  getForMatch(teamId: string, matchId: string): Promise<MatchStatistics> {
    return this.unitOfWork.runInTransaction(tx =>
      this.project(tx, teamId, matchId),
    );
  }

  /** Derive for a match already loaded inside a caller's transaction. */
  async projectFor(
    tx: TransactionScope,
    match: Match,
  ): Promise<MatchStatistics> {
    const ruleset = await this.lookup.requireRuleset(
      tx,
      match.teamId,
      match.rulesetId,
    );
    return this.derive(tx, match, ruleset);
  }

  private async project(
    tx: TransactionScope,
    teamId: string,
    matchId: string,
  ): Promise<MatchStatistics> {
    return this.projectFor(tx, await this.lookup.require(tx, teamId, matchId));
  }

  private async derive(
    tx: TransactionScope,
    match: Match,
    ruleset: MatchRuleset,
  ): Promise<MatchStatistics> {
    return deriveMatchStatistics({
      matchId: match.matchId,
      teamId: match.teamId,
      rulesetKey: ruleset.rulesetKey,
      rulesetVersion: ruleset.rulesetVersion,
      opponentErrorAttribution: ruleset.opponentErrorAttribution,
      plays: await this.plays.listAllForMatch(tx, match.matchId),
      lineups: await this.lineups.listForMatch(tx, match.matchId),
      roster: await this.roster.listMembers(tx, match.matchId),
    });
  }
}
