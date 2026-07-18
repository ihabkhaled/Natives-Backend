import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate, toNullableDate } from '../lib/practices.helpers';
import type {
  CalendarCountRow,
  CalendarFeedTokenRow,
  CalendarIdRow,
} from '../model/calendar.rows';
import type {
  CalendarFeedToken,
  NewCalendarFeedToken,
} from '../model/calendar.types';

/** Digest-only persistence for revocable owner/team/season calendar credentials. */
@Injectable()
export class CalendarFeedTokenRepository {
  async insert(
    scope: TransactionScope,
    token: NewCalendarFeedToken,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "practice_calendar_feed_tokens" ("id", "token_digest",
              "user_id", "team_id", "season_id", "timezone", "expires_at",
              "revoked_at", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)`,
      [
        token.id,
        token.tokenDigest,
        token.userId,
        token.teamId,
        token.seasonId,
        token.timezone,
        token.expiresAt.toISOString(),
        token.createdAt.toISOString(),
      ],
    );
  }

  async countActive(
    scope: TransactionScope,
    userId: string,
    teamId: string,
    now: Date,
  ): Promise<number> {
    const rows = await scope.run<CalendarCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "practice_calendar_feed_tokens"
        WHERE "user_id" = $1 AND "team_id" = $2 AND "revoked_at" IS NULL
          AND "expires_at" > $3`,
      [userId, teamId, now.toISOString()],
    );
    return rows[0]?.count ?? 0;
  }

  async revokeOwned(
    scope: TransactionScope,
    id: string,
    userId: string,
    teamId: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<CalendarIdRow>(
      `UPDATE "practice_calendar_feed_tokens"
          SET "revoked_at" = COALESCE("revoked_at", $4)
        WHERE "id" = $1 AND "user_id" = $2 AND "team_id" = $3
       RETURNING "id"`,
      [id, userId, teamId, now.toISOString()],
    );
    return rows.length > 0;
  }

  async findUsableByDigest(
    scope: TransactionScope,
    digest: string,
    now: Date,
  ): Promise<CalendarFeedToken | null> {
    const rows = await scope.run<CalendarFeedTokenRow>(
      `SELECT "feed".* FROM "practice_calendar_feed_tokens" AS "feed"
        INNER JOIN "teams" ON "teams"."id" = "feed"."team_id"
        INNER JOIN "memberships" ON "memberships"."team_id" = "feed"."team_id"
          AND "memberships"."user_id" = "feed"."user_id"
       WHERE "feed"."token_digest" = $1 AND "feed"."revoked_at" IS NULL
         AND "feed"."expires_at" > $2 AND "teams"."status" = 'active'
         AND "memberships"."status" = 'active'
         AND "memberships"."deleted_at" IS NULL
       ORDER BY "memberships"."created_at" ASC
       LIMIT 1`,
      [digest, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : this.toToken(row);
  }

  private toToken(row: CalendarFeedTokenRow): CalendarFeedToken {
    return {
      id: row.id,
      tokenDigest: row.token_digest,
      userId: row.user_id,
      teamId: row.team_id,
      seasonId: row.season_id,
      timezone: row.timezone,
      expiresAt: toDate(row.expires_at),
      revokedAt: toNullableDate(row.revoked_at),
      createdAt: toDate(row.created_at),
    };
  }
}
