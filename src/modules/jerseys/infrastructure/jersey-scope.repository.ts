import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { JerseyIdRow } from '../model/jerseys.rows';

/**
 * Read-only team/season/member scope probes for jersey operations.
 * Parameterized SQL, single-row existence checks. A missing scope resolves
 * upstream to a 404 that hides existence.
 */
@Injectable()
export class JerseyScopeRepository {
  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<JerseyIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  async seasonExists(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<boolean> {
    const rows = await scope.run<JerseyIdRow>(
      `SELECT "id" FROM "seasons" WHERE "id" = $1 AND "team_id" = $2`,
      [seasonId, teamId],
    );
    return rows.length > 0;
  }

  async membershipExists(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<JerseyIdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    return rows.length > 0;
  }
}
