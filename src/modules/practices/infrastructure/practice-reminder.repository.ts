import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate, toNullableDate } from '../lib/practices.helpers';
import { REMINDER_CANDIDATE_PAGE_LIMIT } from '../model/calendar.constants';
import type { ReminderCandidateRow } from '../model/calendar.rows';
import type { ReminderCandidate } from '../model/calendar.types';

/** Privacy-minimal, bounded candidate lookup for one live practice session. */
@Injectable()
export class PracticeReminderRepository {
  async listCandidates(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    afterUserId: string | null,
  ): Promise<readonly ReminderCandidate[]> {
    const rows = await scope.run<ReminderCandidateRow>(
      `SELECT DISTINCT ON ("memberships"."user_id")
          "sessions"."id" AS "session_id",
          "sessions"."version" AS "session_version",
          "sessions"."team_id", "sessions"."season_id",
          "memberships"."user_id", "sessions"."starts_at",
          "sessions"."rsvp_cutoff_at",
          ("rsvps"."status" IS NOT NULL
            AND "rsvps"."status" <> 'no_response') AS "has_responded"
         FROM "practice_sessions" AS "sessions"
         INNER JOIN "memberships"
           ON "memberships"."team_id" = "sessions"."team_id"
          AND "memberships"."status" = 'active'
          AND "memberships"."deleted_at" IS NULL
          AND "memberships"."user_id" IS NOT NULL
         LEFT JOIN "practice_rsvps" AS "rsvps"
           ON "rsvps"."session_id" = "sessions"."id"
          AND "rsvps"."membership_id" = "memberships"."id"
        WHERE "sessions"."team_id" = $1 AND "sessions"."id" = $2
          AND "sessions"."status" IN ('published', 'rescheduled')
          AND ($3::uuid IS NULL OR "memberships"."user_id" > $3::uuid)
        ORDER BY "memberships"."user_id" ASC
        LIMIT $4`,
      [teamId, sessionId, afterUserId, REMINDER_CANDIDATE_PAGE_LIMIT],
    );
    return rows.map(row => this.toCandidate(row));
  }

  private toCandidate(row: ReminderCandidateRow): ReminderCandidate {
    return {
      sessionId: row.session_id,
      sessionVersion: row.session_version,
      teamId: row.team_id,
      seasonId: row.season_id,
      userId: row.user_id,
      startsAt: toDate(row.starts_at),
      rsvpCutoffAt: toNullableDate(row.rsvp_cutoff_at),
      hasResponded: row.has_responded,
    };
  }
}
