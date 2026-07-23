import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAttendanceFact, toPointsFact } from '../lib/analytics.mapper';
import { REBUILD_MAX_SUBJECTS } from '../model/analytics.constants';
import type {
  AnalyticsIdRow,
  AttendanceFactRow,
  MembershipFactRow,
  PointsFactRow,
} from '../model/analytics.rows';
import type { AttendanceFact, PointsFact } from '../model/analytics.types';

/**
 * Read-only fact projections that feed a rebuild. Every query is a bounded,
 * parameterized aggregate over the source tables (attendance, points, the
 * membership roster). Facts are grouped into monthly period keys, and the roster
 * read returns EVERY active member so a zero-contribution player still gets a
 * projection — completeness counts the members who did nothing.
 */
@Injectable()
export class AnalyticsFactRepository {
  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AnalyticsIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  async membershipExists(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AnalyticsIdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    return rows.length > 0;
  }

  /** Whether the subject membership belongs to the acting user (self-scope). */
  async membershipBelongsToUser(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    userId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AnalyticsIdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "user_id" = $3
          AND "deleted_at" IS NULL`,
      [membershipId, teamId, userId],
    );
    return rows.length > 0;
  }

  /** The active roster in scope — the complete set of subjects to project. */
  async listRoster(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<readonly string[]> {
    const rows = await scope.run<MembershipFactRow>(
      `SELECT m."id" AS "membership_id"
         FROM "memberships" m
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND m."status" NOT IN ('archived', 'anonymized')
          AND ($2::uuid IS NULL OR m."season_id" = $2 OR m."season_id" IS NULL)
        ORDER BY m."id" ASC
        LIMIT $3`,
      [teamId, seasonId, REBUILD_MAX_SUBJECTS],
    );
    return rows.map(row => row.membership_id);
  }

  /** Monthly attendance counts per member. A member with no rows is absent. */
  async listAttendanceFacts(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<readonly AttendanceFact[]> {
    const rows = await scope.run<AttendanceFactRow>(
      `SELECT a."membership_id" AS "membership_id",
              to_char(a."recorded_at", 'YYYY-MM') AS "period_key",
              COUNT(*) FILTER (WHERE a."status" = 'present')::int AS "attended",
              COUNT(*)::int AS "total"
         FROM "attendance_records" a
        WHERE a."team_id" = $1
          AND ($2::uuid IS NULL OR a."season_id" = $2)
        GROUP BY a."membership_id", to_char(a."recorded_at", 'YYYY-MM')
        ORDER BY a."membership_id" ASC
        LIMIT 20000`,
      [teamId, seasonId],
    );
    return rows.map(row => toAttendanceFact(row));
  }

  /** Monthly points totals per member from the append-only ledger. */
  async listPointsFacts(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<readonly PointsFact[]> {
    const rows = await scope.run<PointsFactRow>(
      `SELECT l."membership_id" AS "membership_id",
              to_char(l."effective_on", 'YYYY-MM') AS "period_key",
              COALESCE(SUM(l."amount"), 0)::float8 AS "total"
         FROM "points_ledger" l
        WHERE l."team_id" = $1
          AND ($2::uuid IS NULL OR l."season_id" = $2)
        GROUP BY l."membership_id", to_char(l."effective_on", 'YYYY-MM')
        ORDER BY l."membership_id" ASC
        LIMIT 20000`,
      [teamId, seasonId],
    );
    return rows.map(row => toPointsFact(row));
  }
}
