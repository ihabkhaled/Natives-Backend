import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { GovernanceIdRow } from '../model/governance.rows';

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
}
