import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { SquadScopeNotFoundError } from '../errors/squad-scope-not-found.error';
import { SquadScopeRepository } from '../infrastructure/squad-scope.repository';

/**
 * Enforces the team/season/competition scope of a squad operation. A missing or
 * archived scope resolves to a 404 that hides existence, so a scoped admin cannot
 * probe another team's data. Team identity always comes from the route, validated
 * against the authenticated principal by the permissions guard.
 */
@Injectable()
export class SquadScopeService {
  constructor(private readonly repository: SquadScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    competitionId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new SquadScopeNotFoundError();
    }
    if (!(await this.repository.seasonExistsInTeam(scope, teamId, seasonId))) {
      throw new SquadScopeNotFoundError();
    }
    await this.requireCompetition(scope, teamId, seasonId, competitionId);
  }

  private async requireCompetition(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    competitionId: string | null,
  ): Promise<void> {
    if (competitionId === null) {
      return;
    }
    const exists = await this.repository.competitionExistsInScope(
      scope,
      teamId,
      seasonId,
      competitionId,
    );
    if (!exists) {
      throw new SquadScopeNotFoundError();
    }
  }
}
