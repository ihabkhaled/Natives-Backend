import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { MatchScopeNotFoundError } from '../errors/match-scope-not-found.error';
import { MatchScopeRepository } from '../infrastructure/match-scope.repository';
import type { MatchScope } from '../model/matches.types';

/**
 * Enforces the team/season/competition/fixture/roster scope of a match
 * operation. A missing, deleted, or foreign scope resolves to a 404 that hides
 * existence, so a scoped admin cannot probe another team's fixtures or rosters.
 * Team identity always comes from the route, validated against the authenticated
 * principal by the permissions guard.
 */
@Injectable()
export class MatchScopeService {
  constructor(private readonly repository: MatchScopeRepository) {}

  async forFixture(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
    rosterId: string | null,
  ): Promise<MatchScope> {
    await this.requireActiveTeam(scope, teamId);
    const resolved = await this.repository.resolveFixtureScope(
      scope,
      teamId,
      fixtureId,
    );
    return this.withRoster(scope, teamId, fixtureId, resolved, rosterId);
  }

  async requireSeason(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (seasonId === null) {
      return;
    }
    if (!(await this.repository.seasonExistsInTeam(scope, teamId, seasonId))) {
      throw new MatchScopeNotFoundError();
    }
  }

  async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string | null,
  ): Promise<void> {
    if (membershipId === null) {
      return;
    }
    const exists = await this.repository.membershipExistsInTeam(
      scope,
      teamId,
      membershipId,
    );
    if (!exists) {
      throw new MatchScopeNotFoundError();
    }
  }

  private async withRoster(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
    resolved: MatchScope | null,
    rosterId: string | null,
  ): Promise<MatchScope> {
    const found = this.require(resolved);
    if (rosterId !== null) {
      await this.requireRoster(scope, teamId, fixtureId, rosterId);
    }
    return found;
  }

  private async requireRoster(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
    rosterId: string,
  ): Promise<void> {
    const exists = await this.repository.rosterExistsForFixture(
      scope,
      teamId,
      fixtureId,
      rosterId,
    );
    if (!exists) {
      throw new MatchScopeNotFoundError();
    }
  }

  private async requireActiveTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new MatchScopeNotFoundError();
    }
  }

  private require(resolved: MatchScope | null): MatchScope {
    if (resolved === null) {
      throw new MatchScopeNotFoundError();
    }
    return resolved;
  }
}
