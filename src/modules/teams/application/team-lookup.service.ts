import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import { ResourceStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';

/**
 * Shared read guard for team-scoped writes: resolves an active team within the
 * caller's transaction or raises a not-found error. An archived team is treated
 * as not found for the purpose of adding or changing its scoped child resources.
 */
@Injectable()
export class TeamLookupService {
  constructor(private readonly teams: TeamRepository) {}

  async requireActive(scope: TransactionScope, teamId: string): Promise<Team> {
    const team = await this.teams.findById(scope, teamId);
    if (team === null || team.status === ResourceStatus.Archived) {
      throw new TeamNotFoundError();
    }
    return team;
  }
}
