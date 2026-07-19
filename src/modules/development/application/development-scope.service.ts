import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { DevelopmentScopeNotFoundError } from '../errors/development-scope-not-found.error';
import { DevelopmentScopeRepository } from '../infrastructure/development-scope.repository';

/**
 * Enforces the team/season/membership scope of a development write. A missing or
 * archived scope resolves to a 404 that hides existence, so a scoped coach cannot
 * probe another team's data.
 */
@Injectable()
export class DevelopmentScopeService {
  constructor(private readonly repository: DevelopmentScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new DevelopmentScopeNotFoundError();
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
      throw new DevelopmentScopeNotFoundError();
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
      throw new DevelopmentScopeNotFoundError();
    }
  }
}
