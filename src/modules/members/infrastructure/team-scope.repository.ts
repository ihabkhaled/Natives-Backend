import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { IdRow } from '../model/members.rows';

/**
 * Minimal read over the team scope a membership hangs off. The memberships table
 * has a foreign key into teams; this bounded existence probe lets the invite flow
 * return a clean 404 for a missing/archived team instead of surfacing a raw
 * constraint violation. Read-only, single row, parameterized.
 */
@Injectable()
export class TeamScopeRepository {
  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }
}
