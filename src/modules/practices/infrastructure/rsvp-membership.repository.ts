import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { MembershipRefRow } from '../model/rsvp.rows';
import type { MembershipRef } from '../model/rsvp.types';

/**
 * Bounded, read-only probes into the team-owned membership scope an RSVP hangs
 * off. RSVP writes must resolve an *active* membership in the target team — by the
 * responding account (self) or by id (coach override). A membership in another
 * team, soft-deleted, or in a non-active state resolves to null, so the
 * application returns a clean forbidden/not-found rather than a raw FK violation.
 */
@Injectable()
export class RsvpMembershipRepository {
  async findActiveByUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<MembershipRef | null> {
    const rows = await scope.run<MembershipRefRow>(
      `SELECT "id", "user_id" FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL
        ORDER BY "created_at" ASC
        LIMIT 1`,
      [teamId, userId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRef(row);
  }

  async findActiveById(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MembershipRef | null> {
    const rows = await scope.run<MembershipRefRow>(
      `SELECT "id", "user_id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRef(row);
  }

  private toRef(row: MembershipRefRow): MembershipRef {
    return { id: row.id, userId: row.user_id };
  }
}
