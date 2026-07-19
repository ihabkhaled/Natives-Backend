import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { CountRow, IdRow } from '../model/activity.rows';

/**
 * Read-only scope probes for external-training writes: the team/season are valid,
 * the acting member has an active membership (resolved from the token identity,
 * never a body id), and credited buddies are active members of the same team.
 * Parameterized SQL, bounded single-row/aggregate probes only.
 */
@Injectable()
export class ActivityScopeRepository {
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

  async findActiveMembershipId(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<string | null> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL
        LIMIT 1`,
      [teamId, userId],
    );
    const row = rows[0];
    return row === undefined ? null : row.id;
  }

  async countActiveMembershipsInTeam(
    scope: TransactionScope,
    teamId: string,
    membershipIds: readonly string[],
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "memberships"
        WHERE "team_id" = $1 AND "id" = ANY($2::uuid[])
          AND "status" = 'active' AND "deleted_at" IS NULL`,
      [teamId, membershipIds],
    );
    return rows[0]?.count ?? 0;
  }
}
