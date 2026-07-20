import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMembershipContext } from '../lib/membership-context.mapper';
import { MEMBERSHIP_CONTEXT_MAX } from '../model/members.constants';
import type { MembershipContextRow } from '../model/members.rows';
import type { MembershipContext } from '../model/members.types';

/**
 * Persistence for the principal's own membership contexts. One bounded,
 * parameterized read joins each non-deleted membership of the user to its team
 * and to the season it should display: the membership's own season when it has
 * one, otherwise the team's season covering `asOf` (falling back to the latest
 * non-archived season). A team with no season yields null season columns —
 * never a placeholder. Single statement, static column list, no N+1.
 */
@Injectable()
export class MembershipContextRepository {
  async listForUser(
    scope: TransactionScope,
    userId: string,
    asOf: Date,
  ): Promise<readonly MembershipContext[]> {
    const rows = await scope.run<MembershipContextRow>(
      `SELECT "m"."id" AS "membership_id", "m"."team_id" AS "team_id",
              "t"."slug" AS "team_slug", "t"."name" AS "team_name",
              "s"."id" AS "season_id", "s"."slug" AS "season_slug",
              "s"."name" AS "season_name",
              "m"."status" AS "status", "m"."joined_at" AS "joined_at"
         FROM "memberships" "m"
         JOIN "teams" "t" ON "t"."id" = "m"."team_id"
         LEFT JOIN LATERAL (
              SELECT "c"."id", "c"."slug", "c"."name"
                FROM "seasons" "c"
               WHERE "c"."team_id" = "m"."team_id"
                 AND "c"."status" <> 'archived'
                 AND ("m"."season_id" IS NULL OR "c"."id" = "m"."season_id")
               ORDER BY ($2::date BETWEEN "c"."starts_on" AND "c"."ends_on") DESC,
                        "c"."starts_on" DESC, "c"."id" ASC
               LIMIT 1
         ) "s" ON TRUE
        WHERE "m"."user_id" = $1 AND "m"."deleted_at" IS NULL
        ORDER BY "m"."created_at" ASC, "m"."id" ASC
        LIMIT $3`,
      [userId, asOf.toISOString().slice(0, 10), MEMBERSHIP_CONTEXT_MAX],
    );
    return rows.map(row => toMembershipContext(row));
  }
}
