import { Injectable } from '@nestjs/common';

import { NOTIFICATION_AUDIENCE_PAGE_LIMIT } from '../model/platform.constants';
import type { AudienceUserRow } from '../model/platform.rows';
import type { TransactionScopeLike } from '../model/platform.types';

/** Bounded keyset lookup for active users who may receive team-scoped events. */
@Injectable()
export class NotificationAudienceRepository {
  async listActiveTeamUsers(
    scope: TransactionScopeLike,
    teamId: string,
    afterUserId: string | null,
  ): Promise<readonly string[]> {
    const rows = await scope.run<AudienceUserRow>(
      `SELECT DISTINCT "memberships"."user_id"
         FROM "memberships"
        WHERE "memberships"."team_id" = $1
          AND "memberships"."status" = 'active'
          AND "memberships"."deleted_at" IS NULL
          AND ($2::uuid IS NULL OR "memberships"."user_id" > $2::uuid)
        ORDER BY "memberships"."user_id" ASC
        LIMIT $3`,
      [teamId, afterUserId, NOTIFICATION_AUDIENCE_PAGE_LIMIT],
    );
    return rows.map(row => row.user_id);
  }
}
