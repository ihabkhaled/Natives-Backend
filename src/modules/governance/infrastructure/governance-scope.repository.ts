import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMembershipRef } from '../lib/governance.mapper';
import type {
  GovernanceIdRow,
  GovernanceMembershipRow,
} from '../model/governance.rows';
import type { GovernanceMembershipRef } from '../model/governance.types';

/**
 * Read-only team/member scope probes for governance operations. Parameterized
 * SQL, single-row existence checks only. A missing scope resolves upstream to a
 * 404 that hides existence.
 */
@Injectable()
export class GovernanceScopeRepository {
  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<GovernanceIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  async membershipExists(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<GovernanceIdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    return rows.length > 0;
  }

  /** A membership with its owning user, for actor self-scope checks (BE-3). */
  async findMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<GovernanceMembershipRef | null> {
    const rows = await scope.run<GovernanceMembershipRow>(
      `SELECT "id", "user_id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    return toMembershipRef(rows[0]);
  }

  /** The caller's active membership in the team, for own ack-state reads. */
  async findActiveMembershipByUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<GovernanceMembershipRef | null> {
    const rows = await scope.run<GovernanceMembershipRow>(
      `SELECT "id", "user_id" FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL
        ORDER BY "created_at" ASC
        LIMIT 1`,
      [teamId, userId],
    );
    return toMembershipRef(rows[0]);
  }
}
