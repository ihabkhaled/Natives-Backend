import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  ATTENDANCE_SHEET_OPEN_STATE,
  ATTENDANCE_STATUS_MAX,
  SESSION_DRAFT_STATE,
  SESSION_PUBLISHED_STATE,
  UPCOMING_SESSIONS_MAX,
} from '../model/signals.constants';
import type {
  AttendanceStatusCountRow,
  SignalCountRow,
  UpcomingSessionSignalRow,
} from '../model/signals.rows';

/**
 * Persistence for the practices dashboard projections. Four independent,
 * explicitly bounded, parameterized aggregate reads — no per-session follow-up
 * query, so a dashboard never degrades into an N+1. Data access only: counts and
 * boundary timestamps come back raw and are interpreted by the signal service.
 */
@Injectable()
export class PracticeDashboardRepository {
  listUpcomingSessions(
    scope: TransactionScope,
    teamId: string,
    membershipId: string | null,
    from: Date,
  ): Promise<UpcomingSessionSignalRow[]> {
    return scope.run<UpcomingSessionSignalRow>(
      `SELECT "s"."id" AS "id", "s"."starts_at" AS "starts_at",
              ("r"."id" IS NOT NULL) AS "has_rsvp"
         FROM "practice_sessions" "s"
         LEFT JOIN "practice_rsvps" "r"
           ON "r"."session_id" = "s"."id" AND "r"."membership_id" = $3
        WHERE "s"."team_id" = $1 AND "s"."status" = $4
          AND "s"."starts_at" >= $2
        ORDER BY "s"."starts_at" ASC, "s"."id" ASC
        LIMIT $5`,
      [
        teamId,
        from.toISOString(),
        membershipId,
        SESSION_PUBLISHED_STATE,
        UPCOMING_SESSIONS_MAX,
      ],
    );
  }

  listAttendanceCounts(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<AttendanceStatusCountRow[]> {
    return scope.run<AttendanceStatusCountRow>(
      `SELECT "r"."status" AS "status", COUNT(*)::int AS "count",
              MAX("r"."recorded_at") AS "latest_at"
         FROM "attendance_records" "r"
        WHERE "r"."team_id" = $1 AND "r"."membership_id" = $2
        GROUP BY "r"."status"
        ORDER BY "r"."status" ASC
        LIMIT $3`,
      [teamId, membershipId, ATTENDANCE_STATUS_MAX],
    );
  }

  countDraftSessions(
    scope: TransactionScope,
    teamId: string,
    from: Date,
  ): Promise<SignalCountRow[]> {
    return scope.run<SignalCountRow>(
      `SELECT COUNT(*)::int AS "count", MIN("s"."starts_at") AS "boundary_at"
         FROM "practice_sessions" "s"
        WHERE "s"."team_id" = $1 AND "s"."status" = $3
          AND "s"."starts_at" >= $2`,
      [teamId, from.toISOString(), SESSION_DRAFT_STATE],
    );
  }

  countOpenAttendanceSheets(
    scope: TransactionScope,
    teamId: string,
    until: Date,
  ): Promise<SignalCountRow[]> {
    return scope.run<SignalCountRow>(
      `SELECT COUNT(*)::int AS "count",
              MAX("p"."starts_at") AS "boundary_at"
         FROM "attendance_sheets" "h"
         JOIN "practice_sessions" "p" ON "p"."id" = "h"."session_id"
        WHERE "h"."team_id" = $1 AND "h"."state" = $3
          AND "p"."starts_at" < $2`,
      [teamId, until.toISOString(), ATTENDANCE_SHEET_OPEN_STATE],
    );
  }
}
