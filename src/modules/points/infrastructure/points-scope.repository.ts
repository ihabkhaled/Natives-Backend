import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { IdRow } from '../model/points.rows';

/**
 * Read-only existence checks for the team/season/membership scope a points
 * operation targets, plus resolving the caller's own membership. Parameterized
 * SQL, single-row probes only — never a broad scan. A missing scope resolves
 * upstream to a 404 that hides existence.
 */
@Injectable()
export class PointsScopeRepository {
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

  async membershipExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    return rows.length > 0;
  }

  async membershipForUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<string | null> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2 AND "deleted_at" IS NULL
        LIMIT 1`,
      [teamId, userId],
    );
    return rows[0]?.id ?? null;
  }
}
