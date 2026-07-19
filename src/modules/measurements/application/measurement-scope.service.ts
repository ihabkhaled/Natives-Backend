import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { MeasurementScopeNotFoundError } from '../errors/measurement-scope-not-found.error';
import { MeasurementScopeRepository } from '../infrastructure/measurement-scope.repository';

/**
 * Enforces the team/season/membership scope of a measurement operation. A missing
 * or archived scope resolves to a 404 that hides existence, so a scoped coach
 * cannot probe another team's data. Also resolves the caller's own membership for
 * the self history read.
 */
@Injectable()
export class MeasurementScopeService {
  constructor(private readonly repository: MeasurementScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new MeasurementScopeNotFoundError();
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
      throw new MeasurementScopeNotFoundError();
    }
  }

  async resolveMembershipForUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<string> {
    const membershipId = await this.repository.findActiveMembershipIdForUser(
      scope,
      teamId,
      userId,
    );
    if (membershipId === null) {
      throw new MeasurementScopeNotFoundError();
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
      throw new MeasurementScopeNotFoundError();
    }
  }
}
