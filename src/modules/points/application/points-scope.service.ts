import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { PointsScopeNotFoundError } from '../errors/points-scope-not-found.error';
import { PointsScopeRepository } from '../infrastructure/points-scope.repository';

/**
 * Enforces the team/season/membership scope of a points operation. A missing or
 * archived scope resolves to a 404 that hides existence, so a scoped admin cannot
 * probe another team's data. Also resolves the caller's own membership for the
 * member self read — always from the authenticated identity, never a body param.
 */
@Injectable()
export class PointsScopeService {
  constructor(private readonly repository: PointsScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new PointsScopeNotFoundError();
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
      throw new PointsScopeNotFoundError();
    }
  }

  async requireOwnMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<string> {
    const membershipId = await this.repository.membershipForUser(
      scope,
      teamId,
      userId,
    );
    if (membershipId === null) {
      throw new PointsScopeNotFoundError();
    }
    return membershipId;
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
      throw new PointsScopeNotFoundError();
    }
  }
}
