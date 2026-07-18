import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { IdRow } from '../model/practices.rows';

/**
 * Bounded existence probes over the team-owned scope a practice hangs off. The
 * practice tables carry foreign keys into teams/seasons/venues; these single-row,
 * parameterized reads let the application return a clean 404 for a missing or
 * cross-team scope instead of surfacing a raw constraint violation. Read-only.
 */
@Injectable()
export class PracticeScopeRepository {
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

  async venueExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    venueId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "venues" WHERE "id" = $1 AND "team_id" = $2`,
      [venueId, teamId],
    );
    return rows.length > 0;
  }

  async seasonExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "seasons" WHERE "id" = $1 AND "team_id" = $2`,
      [seasonId, teamId],
    );
    return rows.length > 0;
  }
}
