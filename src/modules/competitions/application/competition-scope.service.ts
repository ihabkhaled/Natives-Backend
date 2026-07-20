import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CompetitionScopeNotFoundError } from '../errors/competition-scope-not-found.error';
import { CompetitionScopeRepository } from '../infrastructure/competition-scope.repository';

/**
 * Enforces the team/season/venue scope of a competition operation. A missing or
 * archived scope resolves to a 404 that hides existence, so a scoped admin cannot
 * probe another team's data. Team identity always comes from the route, validated
 * against the authenticated principal by the permissions guard.
 */
@Injectable()
export class CompetitionScopeService {
  constructor(private readonly repository: CompetitionScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new CompetitionScopeNotFoundError();
    }
    if (!(await this.repository.seasonExistsInTeam(scope, teamId, seasonId))) {
      throw new CompetitionScopeNotFoundError();
    }
  }

  async requireTeam(scope: TransactionScope, teamId: string): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new CompetitionScopeNotFoundError();
    }
  }

  async requireVenue(
    scope: TransactionScope,
    teamId: string,
    venueId: string | null,
  ): Promise<void> {
    if (venueId === null) {
      return;
    }
    if (!(await this.repository.venueExistsInTeam(scope, teamId, venueId))) {
      throw new CompetitionScopeNotFoundError();
    }
  }
}
