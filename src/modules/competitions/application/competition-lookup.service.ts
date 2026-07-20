import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CompetitionNotFoundError } from '../errors/competition-not-found.error';
import { CompetitionRepository } from '../infrastructure/competition.repository';
import type { Competition } from '../model/competitions.types';

/**
 * Resolves a team-owned competition for a write or a scoped read, translating a
 * miss into a 404 that hides existence. Only the team's own competitions are
 * reachable — a cross-team id resolves to not-found, never a leak.
 */
@Injectable()
export class CompetitionLookupService {
  constructor(private readonly repository: CompetitionRepository) {}

  async require(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<Competition> {
    const competition = await this.repository.findForWrite(
      scope,
      teamId,
      competitionId,
    );
    if (competition === null) {
      throw new CompetitionNotFoundError();
    }
    return competition;
  }
}
