import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMatchScope } from '../lib/matches.mapper';
import type { IdRow, MatchScopeRow } from '../model/matches.rows';
import type { MatchScope } from '../model/matches.types';

/**
 * Read-only scope resolution for a match operation. Parameterized SQL, single-row
 * probes only — never a broad scan. A missing scope resolves upstream to a 404
 * that hides existence, so a scoped admin cannot probe another team's fixtures,
 * rosters, or rulesets.
 */
@Injectable()
export class MatchScopeRepository {
  /**
   * The competition, season, and side a live fixture belongs to, within the
   * caller's team. A fixture without its own season inherits the competition's,
   * so a match is always season scoped.
   */
  async resolveFixtureScope(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
  ): Promise<MatchScope | null> {
    const rows = await scope.run<MatchScopeRow>(
      `SELECT f."competition_id" AS "competition_id",
              COALESCE(f."season_id", c."season_id") AS "season_id",
              f."home_away" AS "home_away"
         FROM "fixtures" f
         JOIN "competitions" c ON c."id" = f."competition_id"
        WHERE f."id" = $1 AND f."team_id" = $2 AND f."deleted_at" IS NULL
          AND c."deleted_at" IS NULL`,
      [fixtureId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchScope(row);
  }

  /** True when the match roster belongs to this team and this fixture. */
  async rosterExistsForFixture(
    scope: TransactionScope,
    teamId: string,
    fixtureId: string,
    rosterId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "rosters"
        WHERE "id" = $1 AND "team_id" = $2 AND "fixture_id" = $3`,
      [rosterId, teamId, fixtureId],
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

  /** True when the membership belongs to this team, for scorer attribution. */
  async membershipExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2`,
      [membershipId, teamId],
    );
    return rows.length > 0;
  }

  /** True when the season belongs to this team (a ruleset may be scoped to it). */
  async seasonExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "seasons" WHERE "id" = $1 AND "team_id" = $2`,
      [seasonId, teamId],
    );
    return rows.length > 0;
  }
}
