import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { ActivityScopeNotFoundError } from '../errors/activity-scope-not-found.error';
import { ActivityScopeRepository } from '../infrastructure/activity-scope.repository';

/**
 * Enforces the team/season/membership scope of an external-training write. The
 * acting member's membership is resolved from the token identity (never a body
 * id), so a member can only ever submit for themselves. A missing team, season,
 * membership, or non-member buddy resolves to a 404 that hides existence.
 */
@Injectable()
export class ActivityScopeService {
  constructor(private readonly repository: ActivityScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new ActivityScopeNotFoundError();
    }
    await this.validateSeason(scope, teamId, seasonId);
  }

  async resolveActingMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<string> {
    const membershipId = await this.repository.findActiveMembershipId(
      scope,
      teamId,
      userId,
    );
    if (membershipId === null) {
      throw new ActivityScopeNotFoundError();
    }
    return membershipId;
  }

  async requireBuddyMemberships(
    scope: TransactionScope,
    teamId: string,
    membershipIds: readonly string[],
  ): Promise<void> {
    if (membershipIds.length === 0) {
      return;
    }
    const count = await this.repository.countActiveMembershipsInTeam(
      scope,
      teamId,
      membershipIds,
    );
    if (count !== membershipIds.length) {
      throw new ActivityScopeNotFoundError();
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
      throw new ActivityScopeNotFoundError();
    }
  }
}
