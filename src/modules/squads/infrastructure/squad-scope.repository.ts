import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { IdRow } from '../model/squads.rows';

/**
 * Read-only existence checks for the team/season/competition scope a squad
 * targets. Parameterized SQL, single-row probes only — never a broad scan. A
 * missing scope resolves upstream to a 404 that hides existence, so a scoped
 * admin cannot probe another team's data.
 */
@Injectable()
export class SquadScopeRepository {
  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  async seasonExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "seasons"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" <> 'archived'`,
      [seasonId, teamId],
    );
    return rows.length > 0;
  }

  async competitionExistsInScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    competitionId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "competitions"
        WHERE "id" = $1 AND "team_id" = $2 AND "season_id" = $3
          AND "deleted_at" IS NULL`,
      [competitionId, teamId, seasonId],
    );
    return rows.length > 0;
  }
}
