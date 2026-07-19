import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  ABSENT_STATUS,
  ASSESSMENT_SOURCED_CATEGORIES,
  ATTENDED_STATUSES,
  EXCUSED_STATUSES,
  REBUILD_SCAN_MAX,
  SCORABLE_SHEET_STATES,
} from '../model/scoring.constants';
import type {
  AttendanceCountsRow,
  CategorySourceRow,
  MembershipRow,
} from '../model/scoring.rows';

/**
 * Read-only source-fact access for projection rebuilds and simulations. Reads
 * published, non-superseded player assessments (301) and finalized attendance
 * (202) and aggregates them per membership+category. Null observations are
 * excluded from the value array but still counted in the total so coverage stays
 * honest; a measured 0 is carried as a present value; excused/injured attendance
 * is held apart so it never enters the attendance denominator. Data access only —
 * parameterized, bounded, and deterministically ordered.
 */
@Injectable()
export class ScoreSourceRepository {
  async listActiveMemberships(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly MembershipRow[]> {
    return scope.run<MembershipRow>(
      `SELECT "id" AS "membership_id" FROM "memberships"
        WHERE "team_id" = $1 AND "status" = 'active' AND "deleted_at" IS NULL
        ORDER BY "id" ASC
        LIMIT ${REBUILD_SCAN_MAX}`,
      [teamId],
    );
  }

  async categorySourcesForTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly CategorySourceRow[]> {
    return scope.run<CategorySourceRow>(this.sourcesSql(false), [
      teamId,
      ASSESSMENT_SOURCED_CATEGORIES,
    ]);
  }

  async categorySourcesForMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly CategorySourceRow[]> {
    return scope.run<CategorySourceRow>(this.sourcesSql(true), [
      teamId,
      ASSESSMENT_SOURCED_CATEGORIES,
      membershipId,
    ]);
  }

  async attendanceCountsForTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly AttendanceCountsRow[]> {
    return scope.run<AttendanceCountsRow>(this.attendanceSql(false), [
      teamId,
      ATTENDED_STATUSES,
      ABSENT_STATUS,
      EXCUSED_STATUSES,
      SCORABLE_SHEET_STATES,
    ]);
  }

  async attendanceCountsForMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly AttendanceCountsRow[]> {
    return scope.run<AttendanceCountsRow>(this.attendanceSql(true), [
      teamId,
      ATTENDED_STATUSES,
      ABSENT_STATUS,
      EXCUSED_STATUSES,
      SCORABLE_SHEET_STATES,
      membershipId,
    ]);
  }

  private sourcesSql(singleMembership: boolean): string {
    const membershipFilter = singleMembership
      ? `AND pa."membership_id" = $3`
      : '';
    return `SELECT pa."membership_id" AS "membership_id",
              cat."category_key" AS "category_key",
              COALESCE(
                array_agg(v."numeric_value")
                  FILTER (WHERE v."numeric_value" IS NOT NULL),
                '{}'
              ) AS "values",
              COUNT(*)::int AS "total_metrics"
         FROM "player_assessments" pa
         JOIN "player_assessment_metric_values" v
           ON v."assessment_id" = pa."id"
         JOIN "assessment_metric_definitions" md
           ON md."id" = v."metric_definition_id"
         JOIN "assessment_metric_categories" cat
           ON cat."id" = md."category_id"
        WHERE pa."team_id" = $1 AND pa."status" = 'published'
          AND pa."superseded_at" IS NULL
          AND cat."category_key" = ANY($2) ${membershipFilter}
        GROUP BY pa."membership_id", cat."category_key"
        ORDER BY pa."membership_id" ASC, cat."category_key" ASC`;
  }

  private attendanceSql(singleMembership: boolean): string {
    const membershipFilter = singleMembership
      ? `AND ar."membership_id" = $6`
      : '';
    return `SELECT ar."membership_id" AS "membership_id",
              COUNT(*) FILTER (WHERE ar."status" = ANY($2))::int AS "attended",
              COUNT(*) FILTER (WHERE ar."status" = $3)::int AS "absent",
              COUNT(*) FILTER (WHERE ar."status" = ANY($4))::int AS "excused"
         FROM "attendance_records" ar
         JOIN "attendance_sheets" sh ON sh."id" = ar."sheet_id"
        WHERE ar."team_id" = $1 AND sh."state" = ANY($5) ${membershipFilter}
        GROUP BY ar."membership_id"
        ORDER BY ar."membership_id" ASC
        LIMIT ${REBUILD_SCAN_MAX}`;
  }
}
