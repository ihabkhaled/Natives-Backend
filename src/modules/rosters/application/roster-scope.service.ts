import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { RosterScopeNotFoundError } from '../errors/roster-scope-not-found.error';
import { RosterScopeRepository } from '../infrastructure/roster-scope.repository';
import type { RosterScope } from '../model/rosters.types';

/**
 * Enforces the team/season/competition/fixture/squad scope of a roster
 * operation. A missing, deleted, or foreign scope resolves to a 404 that hides
 * existence, so a scoped admin cannot probe another team's data. Team identity
 * always comes from the route, validated against the authenticated principal by
 * the permissions guard.
 */
@Injectable()
export class RosterScopeService {
  constructor(private readonly repository: RosterScopeRepository) {}

  async forCompetition(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
    squadId: string | null,
  ): Promise<RosterScope> {
    await this.requireActiveTeam(scope, teamId);
    const resolved = await this.repository.resolveCompetitionScope(
      scope,
      teamId,
      competitionId,
    );
    return this.withSquad(scope, teamId, resolved, squadId);
  }

  async forFixture(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
  ): Promise<RosterScope> {
    await this.requireActiveTeam(scope, teamId);
    const resolved = await this.repository.resolveFixtureScope(
      scope,
      teamId,
      fixtureId,
    );
    return this.require(resolved);
  }

  private async withSquad(
    scope: TransactionScope,
    teamId: string,
    resolved: RosterScope | null,
    squadId: string | null,
  ): Promise<RosterScope> {
    const found = this.require(resolved);
    if (squadId !== null) {
      await this.requireSquad(scope, teamId, found.seasonId, squadId);
    }
    return found;
  }

  private async requireSquad(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    squadId: string,
  ): Promise<void> {
    const exists = await this.repository.squadExistsInScope(
      scope,
      teamId,
      seasonId,
      squadId,
    );
    if (!exists) {
      throw new RosterScopeNotFoundError();
    }
  }

  private async requireActiveTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new RosterScopeNotFoundError();
    }
  }

  private require(resolved: RosterScope | null): RosterScope {
    if (resolved === null) {
      throw new RosterScopeNotFoundError();
    }
    return resolved;
  }
}
