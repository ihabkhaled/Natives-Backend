import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MatchEventRepository } from '../infrastructure/match-event.repository';
import {
  buildScoreboard,
  resolveElapsedMinutes,
} from '../lib/match-scoreboard.factory';
import type {
  Match,
  MatchRuleset,
  MatchScoreboard,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * The live scoreboard projection (match.read). Nothing on it is stored: the
 * effective target, the cap that decided it, the completion signal, and the
 * timeout budget are re-derived from the versioned ruleset and the append-only
 * stream every time, and the projection cites the ruleset key/version and engine
 * version so a displayed number is always explainable.
 */
@Injectable()
export class MatchScoreboardService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: MatchLookupService,
    private readonly events: MatchEventRepository,
  ) {}

  getForMatch(teamId: string, matchId: string): Promise<MatchScoreboard> {
    return this.unitOfWork.runInTransaction(tx =>
      this.project(tx, teamId, matchId),
    );
  }

  /** Project a match already loaded inside a caller's transaction. */
  async projectFor(
    tx: TransactionScope,
    match: Match,
  ): Promise<MatchScoreboard> {
    const ruleset = await this.lookup.requireRuleset(
      tx,
      match.teamId,
      match.rulesetId,
    );
    return this.withUsage(tx, match, ruleset);
  }

  private async withUsage(
    tx: TransactionScope,
    match: Match,
    ruleset: MatchRuleset,
  ): Promise<MatchScoreboard> {
    const usage = await this.events.countTimeouts(
      tx,
      match.matchId,
      match.period,
    );
    return buildScoreboard(
      match,
      ruleset,
      usage,
      resolveElapsedMinutes(match, this.clock.now()),
    );
  }

  private async project(
    tx: TransactionScope,
    teamId: string,
    matchId: string,
  ): Promise<MatchScoreboard> {
    return this.projectFor(tx, await this.lookup.require(tx, teamId, matchId));
  }
}
