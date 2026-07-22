import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { StandingsScopeNotFoundError } from '../errors/standings-scope-not-found.error';
import { StandingsScopeRepository } from '../infrastructure/standings-scope.repository';
import type {
  FinalizedMatchResult,
  StandingsScope,
} from '../model/standings.types';

/**
 * Enforces the team/season/competition scope of a standings operation. A
 * missing, deleted, or foreign scope resolves to a 404 that hides existence, so
 * a scoped admin cannot probe another team's competitions, stages, or opponents.
 */
@Injectable()
export class StandingsScopeService {
  constructor(private readonly repository: StandingsScopeRepository) {}

  async forCompetition(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<StandingsScope> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new StandingsScopeNotFoundError();
    }
    return this.resolveScope(scope, teamId, competitionId);
  }

  private async resolveScope(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<StandingsScope> {
    const resolved = await this.repository.resolveCompetitionScope(
      scope,
      teamId,
      competitionId,
    );
    if (resolved === null) {
      throw new StandingsScopeNotFoundError();
    }
    return {
      teamId,
      seasonId: resolved.season_id,
      competitionId: resolved.competition_id,
    };
  }

  async requireStage(
    scope: TransactionScope,
    competitionId: string,
    stageId: string | null,
  ): Promise<void> {
    if (stageId === null) {
      return;
    }
    const exists = await this.repository.stageExistsInCompetition(
      scope,
      competitionId,
      stageId,
    );
    if (!exists) {
      throw new StandingsScopeNotFoundError();
    }
  }

  async requireOpponent(
    scope: TransactionScope,
    teamId: string,
    opponentId: string | null,
  ): Promise<void> {
    if (opponentId === null) {
      return;
    }
    if (
      !(await this.repository.opponentExistsInTeam(scope, teamId, opponentId))
    ) {
      throw new StandingsScopeNotFoundError();
    }
  }

  listFinalizedResults(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<readonly FinalizedMatchResult[]> {
    return this.repository.listFinalizedResults(scope, teamId, competitionId);
  }
}
