import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { ScoringScopeNotFoundError } from '../errors/scoring-scope-not-found.error';
import { ScoringScopeRepository } from '../infrastructure/scoring-scope.repository';

/**
 * Enforces the team/season/membership scope of a scoring operation. A missing or
 * archived scope resolves to a 404 that hides existence, so a scoped admin cannot
 * probe another team's data.
 */
@Injectable()
export class ScoringScopeService {
  constructor(private readonly repository: ScoringScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new ScoringScopeNotFoundError();
    }
    await this.validateSeason(scope, teamId, seasonId);
  }

  async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    const exists = await this.repository.membershipExistsInTeam(
      scope,
      teamId,
      membershipId,
    );
    if (!exists) {
      throw new ScoringScopeNotFoundError();
    }
  }

  private async validateSeason(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (seasonId === null) {
      return;
    }
    if (!(await this.repository.seasonExistsInTeam(scope, teamId, seasonId))) {
      throw new ScoringScopeNotFoundError();
    }
  }
}
