import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { IdRow, ScopeRow } from '../model/rosters.rows';
import type { RosterScope } from '../model/rosters.types';

/**
 * Read-only scope resolution for a roster operation. Parameterized SQL,
 * single-row probes only — never a broad scan. A missing scope resolves upstream
 * to a 404 that hides existence, so a scoped admin cannot probe another team's
 * competitions, fixtures, or squads.
 */
@Injectable()
export class RosterScopeRepository {
  /** The season a live competition belongs to, within the caller's team. */
  async resolveCompetitionScope(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<RosterScope | null> {
    const rows = await scope.run<ScopeRow>(
      `SELECT c."id" AS "competition_id", c."season_id" AS "season_id"
         FROM "competitions" c
        WHERE c."id" = $1 AND c."team_id" = $2 AND c."deleted_at" IS NULL`,
      [competitionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toScope(row);
  }

  /**
   * The competition and season a live fixture belongs to. A fixture without its
   * own season inherits the competition's, so a match roster is always season
   * scoped.
   */
  async resolveFixtureScope(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
  ): Promise<RosterScope | null> {
    const rows = await scope.run<ScopeRow>(
      `SELECT f."competition_id" AS "competition_id",
              COALESCE(f."season_id", c."season_id") AS "season_id"
         FROM "fixtures" f
         JOIN "competitions" c ON c."id" = f."competition_id"
        WHERE f."id" = $1 AND f."team_id" = $2 AND f."deleted_at" IS NULL
          AND c."deleted_at" IS NULL`,
      [fixtureId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toScope(row);
  }

  async squadExistsInScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    squadId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "squads"
        WHERE "id" = $1 AND "team_id" = $2 AND "season_id" = $3
          AND "deleted_at" IS NULL`,
      [squadId, teamId, seasonId],
    );
    return rows.length > 0;
  }

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

  private toScope(row: ScopeRow): RosterScope {
    return { competitionId: row.competition_id, seasonId: row.season_id };
  }
}
