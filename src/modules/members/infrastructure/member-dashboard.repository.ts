import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { MEMBERSHIP_INVITED_STATE } from '../model/members.constants';
import type {
  MemberSignalCountRow,
  ProfileCompletenessRow,
} from '../model/members.rows';

/**
 * Persistence for the members dashboard projections. One single-row profile read
 * scoped to the team, and one bounded roster aggregate. Data access only — the
 * completeness percentage is scored by the domain policy, never in SQL.
 */
@Injectable()
export class MemberDashboardRepository {
  findProfileCompleteness(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<ProfileCompletenessRow[]> {
    return scope.run<ProfileCompletenessRow>(
      `SELECT "p"."preferred_name", "p"."email", "p"."phone", "p"."gender",
              to_char("p"."date_of_birth", 'YYYY-MM-DD') AS "date_of_birth",
              "p"."jersey_number", "p"."positions", "p"."avatar_media_id",
              "p"."updated_at"
         FROM "member_profiles" "p"
        WHERE "p"."membership_id" = $1 AND "p"."team_id" = $2
        LIMIT 1`,
      [membershipId, teamId],
    );
  }

  countInvitedMembers(
    scope: TransactionScope,
    teamId: string,
  ): Promise<MemberSignalCountRow[]> {
    return scope.run<MemberSignalCountRow>(
      `SELECT COUNT(*)::int AS "count", MIN("m"."created_at") AS "boundary_at"
         FROM "memberships" "m"
        WHERE "m"."team_id" = $1 AND "m"."status" = $2
          AND "m"."deleted_at" IS NULL`,
      [teamId, MEMBERSHIP_INVITED_STATE],
    );
  }
}
