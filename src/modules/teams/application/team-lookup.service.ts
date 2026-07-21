import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { canAcceptTeamWork } from '../domain/team-lifecycle.state-machine';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import type { Team } from '../model/teams.types';

/**
 * Shared read guard for team-scoped writes: resolves a team that can accept new
 * work within the caller's transaction, or raises not-found. A disabled,
 * archived or soft-removed team is treated as not found for the purpose of
 * adding or changing its scoped child resources — its history stays intact.
 */
@Injectable()
export class TeamLookupService {
  constructor(private readonly teams: TeamRepository) {}

  async requireActive(scope: TransactionScope, teamId: string): Promise<Team> {
    const team = await this.teams.findById(scope, teamId);
    if (team === null || !canAcceptTeamWork(team.status, team.deletedAt)) {
      throw new TeamNotFoundError();
    }
    return team;
  }
}
