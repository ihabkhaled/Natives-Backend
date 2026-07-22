import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { AnalysisScopeNotFoundError } from '../errors/analysis-scope-not-found.error';
import { AnalysisScopeRepository } from '../infrastructure/analysis-scope.repository';
import type { AnalysisScope } from '../model/analysis.types';

/**
 * Enforces the team/season scope of an analysis operation. A missing, archived,
 * or foreign scope resolves to a 404 that hides existence, so a scoped admin
 * cannot probe another team's matches. Team identity always comes from the
 * route, validated against the authenticated principal by the permissions guard.
 */
@Injectable()
export class AnalysisScopeService {
  constructor(private readonly repository: AnalysisScopeRepository) {}

  async forMatch(
    scope: TransactionScope,
    teamId: string,
    matchId: string | null,
  ): Promise<AnalysisScope> {
    await this.requireActiveTeam(scope, teamId);
    const seasonId =
      matchId === null
        ? await this.repository.resolveCurrentSeason(scope, teamId)
        : await this.repository.resolveMatchSeason(scope, teamId, matchId);
    if (seasonId === null) {
      throw new AnalysisScopeNotFoundError();
    }
    return { teamId, seasonId };
  }

  listViewerMemberships(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<readonly string[]> {
    return this.repository.listViewerMemberships(scope, teamId, userId);
  }

  filterTeamMemberships(
    scope: TransactionScope,
    teamId: string,
    membershipIds: readonly string[],
  ): Promise<readonly string[]> {
    return this.repository.filterTeamMemberships(scope, teamId, membershipIds);
  }

  resolveAliasMembership(
    scope: TransactionScope,
    teamId: string,
    alias: string,
  ): Promise<string | null> {
    return this.repository.resolveAliasMembership(scope, teamId, alias);
  }

  private async requireActiveTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new AnalysisScopeNotFoundError();
    }
  }
}
