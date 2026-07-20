import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { IdRow } from '../model/competitions.rows';

/**
 * Read-only existence checks for the team/season/venue scope a competition or
 * fixture targets. Parameterized SQL, single-row probes only — never a broad scan.
 * A missing scope resolves upstream to a 404 that hides existence.
 */
@Injectable()
export class CompetitionScopeRepository {
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

  async seasonExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "seasons"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" <> 'archived'`,
      [seasonId, teamId],
    );
    return rows.length > 0;
  }

  async venueExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    venueId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "venues"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'`,
      [venueId, teamId],
    );
    return rows.length > 0;
  }
}
