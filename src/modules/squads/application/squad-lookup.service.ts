import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { SquadNotFoundError } from '../errors/squad-not-found.error';
import { SquadRepository } from '../infrastructure/squad.repository';
import type { Squad } from '../model/squads.types';

/**
 * Resolves a team-owned squad for a write or a scoped read, translating a miss
 * into a 404 that hides existence. Only the team's own squads are reachable — a
 * cross-team id resolves to not-found, never a leak.
 */
@Injectable()
export class SquadLookupService {
  constructor(private readonly repository: SquadRepository) {}

  async require(
    scope: TransactionScope,
    teamId: string,
    squadId: string,
  ): Promise<Squad> {
    const squad = await this.repository.findForWrite(scope, teamId, squadId);
    if (squad === null) {
      throw new SquadNotFoundError();
    }
    return squad;
  }
}
