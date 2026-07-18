import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { AttendanceMembershipRow } from '../model/attendance.rows';
import type { MembershipRef } from '../model/attendance.types';

/**
 * Bounded, read-only probes into the team-owned membership scope an attendance
 * record hangs off. Recording resolves an *active* membership (self by user, coach
 * by id); a correction may target any non-deleted membership in the team, since a
 * historical member may have since become inactive. A membership in another team or
 * soft-deleted resolves to null, so the application returns a clean forbidden /
 * not-found rather than a raw foreign-key violation.
 */
@Injectable()
export class AttendanceMembershipRepository {
  async findActiveByUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<MembershipRef | null> {
    const rows = await scope.run<AttendanceMembershipRow>(
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
    const rows = await scope.run<AttendanceMembershipRow>(
      `SELECT "id", "user_id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRef(row);
  }

  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MembershipRef | null> {
    const rows = await scope.run<AttendanceMembershipRow>(
      `SELECT "id", "user_id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRef(row);
  }

  private toRef(row: AttendanceMembershipRow): MembershipRef {
    return { id: row.id, userId: row.user_id };
  }
}
