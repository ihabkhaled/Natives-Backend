import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type {
  AnalysisIdRow,
  AnalysisMembershipRow,
  AnalysisScopeRow,
} from '../model/analysis.rows';

/**
 * Read-only scope resolution for an analysis operation. Parameterized SQL,
 * single-row probes and bounded id reads only — never a broad scan. A missing
 * scope resolves upstream to a 404 that hides existence, so a scoped admin
 * cannot probe another team's matches or members.
 */
@Injectable()
export class AnalysisScopeRepository {
  /** The team's current season, used when a source is registered. */
  async resolveCurrentSeason(
    scope: TransactionScope,
    teamId: string,
  ): Promise<string | null> {
    const rows = await scope.run<AnalysisScopeRow>(
      `SELECT s."id" AS "season_id"
         FROM "seasons" s
        WHERE s."team_id" = $1 AND s."status" <> 'archived'
        ORDER BY s."starts_on" DESC, s."id" ASC
        LIMIT 1`,
      [teamId],
    );
    return rows[0]?.season_id ?? null;
  }

  /** The season a live match belongs to, within the caller's team. */
  async resolveMatchSeason(
    scope: TransactionScope,
    teamId: string,
    matchId: string,
  ): Promise<string | null> {
    const rows = await scope.run<AnalysisScopeRow>(
      `SELECT m."season_id" AS "season_id"
         FROM "matches" m
        WHERE m."id" = $1 AND m."team_id" = $2`,
      [matchId, teamId],
    );
    return rows[0]?.season_id ?? null;
  }

  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AnalysisIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  /** The caller's own memberships in the team — the "is this about me" input. */
  async listViewerMemberships(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<readonly string[]> {
    const rows = await scope.run<AnalysisMembershipRow>(
      `SELECT m."id" AS "membership_id"
         FROM "memberships" m
        WHERE m."team_id" = $1 AND m."user_id" = $2
          AND m."deleted_at" IS NULL
        ORDER BY m."id" ASC
        LIMIT 50`,
      [teamId, userId],
    );
    return rows.map(row => row.membership_id);
  }

  /** Keep only ids that are real memberships of this team. */
  async filterTeamMemberships(
    scope: TransactionScope,
    teamId: string,
    membershipIds: readonly string[],
  ): Promise<readonly string[]> {
    if (membershipIds.length === 0) {
      return [];
    }
    const rows = await scope.run<AnalysisMembershipRow>(
      `SELECT m."id" AS "membership_id"
         FROM "memberships" m
        WHERE m."team_id" = $1 AND m."id" = ANY($2::uuid[])
          AND m."deleted_at" IS NULL
        ORDER BY m."id" ASC`,
      [teamId, [...membershipIds]],
    );
    return rows.map(row => row.membership_id);
  }

  /**
   * Resolve a legacy spreadsheet spelling to a membership through the member
   * alias table. Matching is case- and whitespace-insensitive; an alias that
   * resolves to more than one membership resolves to NOTHING, so an ambiguous
   * name is quarantined for a human rather than silently attached to a player.
   */
  async resolveAliasMembership(
    scope: TransactionScope,
    teamId: string,
    alias: string,
  ): Promise<string | null> {
    const rows = await scope.run<AnalysisMembershipRow>(
      `SELECT a."membership_id" AS "membership_id"
         FROM "member_aliases" a
        WHERE a."team_id" = $1
          AND a."deleted_at" IS NULL
          AND lower(btrim(a."alias")) = lower(btrim($2))
        LIMIT 2`,
      [teamId, alias],
    );
    return rows.length === 1 ? (rows[0]?.membership_id ?? null) : null;
  }
}
