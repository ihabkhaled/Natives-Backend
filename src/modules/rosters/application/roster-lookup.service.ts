import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { RosterNotFoundError } from '../errors/roster-not-found.error';
import { RosterRepository } from '../infrastructure/roster.repository';
import type { Roster } from '../model/rosters.types';

/**
 * Resolves a team-owned roster for a write or a scoped read, translating a miss
 * into a 404 that hides existence. Only the team's own rosters are reachable — a
 * cross-team id resolves to not-found, never a leak.
 */
@Injectable()
export class RosterLookupService {
  constructor(private readonly repository: RosterRepository) {}

  async require(
    scope: TransactionScope,
    teamId: string,
    rosterId: string,
  ): Promise<Roster> {
    const roster = await this.repository.findForWrite(scope, teamId, rosterId);
    if (roster === null) {
      throw new RosterNotFoundError();
    }
    return roster;
  }
}
