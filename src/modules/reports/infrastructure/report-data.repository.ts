import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { REPORT_DATA_MAX_ROWS } from '../model/reports.data.constants';
import type {
  AttendanceDataRow,
  LeaderboardDataRow,
  RosterDataRow,
} from '../model/reports.rows';
import type { ReportRow } from '../model/reports.types';

/**
 * Read-only data sources that feed report rendering. Every query is a bounded,
 * parameterized read.
 *
 * The attendance and roster datasets are LEFT-joined off the full active roster
 * so every member appears — including the zero-contribution members who attended
 * nothing — because a report that silently drops the players who did least is
 * the exact defect the invariant guards against. Values are returned as strings
 * ready for the safety policy to neutralize.
 */
@Injectable()
export class ReportDataRepository {
  /** Attendance per member: present/total counts, complete over the roster. */
  async attendanceRows(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<readonly ReportRow[]> {
    const rows = await scope.run<AttendanceDataRow>(
      `SELECT m."id" AS "membership_id",
              COUNT(a."id") FILTER (WHERE a."status" = 'present')::int
                AS "attended",
              COUNT(a."id")::int AS "total"
         FROM "memberships" m
         LEFT JOIN "attendance_records" a
           ON a."membership_id" = m."id" AND a."team_id" = m."team_id"
              AND ($2::uuid IS NULL OR a."season_id" = $2)
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND m."status" NOT IN ('archived', 'anonymized')
        GROUP BY m."id"
        ORDER BY m."id" ASC
        LIMIT $3`,
      [teamId, seasonId, REPORT_DATA_MAX_ROWS],
    );
    return rows.map(row => ({
      membershipId: row.membership_id,
      attended: String(row.attended),
      total: String(row.total),
    }));
  }

  /** Points per member: totals, complete over the roster (zero included). */
  async leaderboardRows(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<readonly ReportRow[]> {
    const rows = await scope.run<LeaderboardDataRow>(
      `SELECT m."id" AS "membership_id",
              COALESCE(SUM(l."amount"), 0)::float8 AS "total"
         FROM "memberships" m
         LEFT JOIN "points_ledger" l
           ON l."membership_id" = m."id" AND l."team_id" = m."team_id"
              AND ($2::uuid IS NULL OR l."season_id" = $2)
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND m."status" NOT IN ('archived', 'anonymized')
        GROUP BY m."id"
        ORDER BY "total" DESC, m."id" ASC
        LIMIT $3`,
      [teamId, seasonId, REPORT_DATA_MAX_ROWS],
    );
    return rows.map(row => ({
      membershipId: row.membership_id,
      points: String(row.total),
    }));
  }

  /** The roster: every active member, jersey number when known. */
  async rosterRows(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly ReportRow[]> {
    const rows = await scope.run<RosterDataRow>(
      `SELECT m."id" AS "membership_id", m."status" AS "status",
              p."jersey_number" AS "jersey_number"
         FROM "memberships" m
         LEFT JOIN "member_profiles" p ON p."membership_id" = m."id"
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND m."status" NOT IN ('archived', 'anonymized')
        ORDER BY m."id" ASC
        LIMIT $2`,
      [teamId, REPORT_DATA_MAX_ROWS],
    );
    return rows.map(row => ({
      membershipId: row.membership_id,
      status: row.status,
      jerseyNumber: row.jersey_number === null ? '' : String(row.jersey_number),
    }));
  }
}
