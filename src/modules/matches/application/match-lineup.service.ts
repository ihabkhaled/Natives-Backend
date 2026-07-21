import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isLineupValid } from '../domain/match-lineup.policy';
import { MatchLineupInvalidError } from '../errors/match-lineup-invalid.error';
import { MatchPointLineupRepository } from '../infrastructure/match-point-lineup.repository';
import { MatchRosterRepository } from '../infrastructure/match-roster.repository';
import { buildLineupEntry } from '../lib/matches.builders';
import type {
  Match,
  MatchPlayEvent,
  MatchPointLineupEntry,
  NewMatchPointLineupEntry,
  StartPointContent,
} from '../model/matches.types';
import { MatchScopeService } from './match-scope.service';

/**
 * Records who was on the line for a point. The lineup is the ONLY source of
 * "points played", so it is validated against the configured constraints before
 * a single row is written and every named player is checked against the team.
 *
 * Rows hang off the point-start fact, never off the match directly: retracting
 * that fact takes the whole line out of the derivation without rewriting
 * anything, which is what lets a corrected stream rebuild identically.
 */
@Injectable()
export class MatchLineupService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lineups: MatchPointLineupRepository,
    private readonly roster: MatchRosterRepository,
    private readonly scope: MatchScopeService,
  ) {}

  assertValid(content: StartPointContent): void {
    if (!isLineupValid(content.lineMembershipIds, content.pullerMembershipId)) {
      throw new MatchLineupInvalidError();
    }
  }

  async record(
    tx: TransactionScope,
    match: Match,
    play: MatchPlayEvent,
    content: StartPointContent,
    now: Date,
  ): Promise<readonly MatchPointLineupEntry[]> {
    const recorded: MatchPointLineupEntry[] = [];
    for (const membershipId of content.lineMembershipIds) {
      recorded.push(
        await this.recordOne(tx, match, play, membershipId, content, now),
      );
    }
    return recorded;
  }

  listForPlay(
    tx: TransactionScope,
    playId: string,
  ): Promise<readonly MatchPointLineupEntry[]> {
    return this.lineups.listForPlay(tx, playId);
  }

  listForMatch(
    tx: TransactionScope,
    matchId: string,
  ): Promise<readonly MatchPointLineupEntry[]> {
    return this.lineups.listForMatch(tx, matchId);
  }

  private async recordOne(
    tx: TransactionScope,
    match: Match,
    play: MatchPlayEvent,
    membershipId: string,
    content: StartPointContent,
    now: Date,
  ): Promise<MatchPointLineupEntry> {
    await this.scope.requireMembership(tx, match.teamId, membershipId);
    const rosterEntryId = await this.roster.findEntryId(
      tx,
      match.matchId,
      membershipId,
    );
    return this.lineups.insert(
      tx,
      this.toEntry(match, play, membershipId, rosterEntryId, content, now),
    );
  }

  private toEntry(
    match: Match,
    play: MatchPlayEvent,
    membershipId: string,
    rosterEntryId: string | null,
    content: StartPointContent,
    now: Date,
  ): NewMatchPointLineupEntry {
    return buildLineupEntry(
      this.idGenerator.generate(),
      match,
      play.playId,
      play.pointNumber,
      membershipId,
      rosterEntryId,
      content.pullerMembershipId === membershipId,
      now,
    );
  }
}
