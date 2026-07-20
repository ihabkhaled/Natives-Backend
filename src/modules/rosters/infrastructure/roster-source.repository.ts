import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRosterCandidate } from '../lib/rosters.mapper';
import {
  CANDIDATE_SELECT,
  EXCLUDED_CANDIDATE_STATES,
  GENERATE_MAX_ENTRIES,
} from '../model/rosters.constants';
import type {
  CountRow,
  IdRow,
  RosterCandidateRow,
} from '../model/rosters.rows';
import type { RosterCandidate } from '../model/rosters.types';

/**
 * Read-only access to the pool a roster is drawn from: the team's memberships,
 * their profile classification, their declaration for this roster, and whether
 * the season squad selected them. Reads the shared membership, profile, and
 * squad-selection tables through parameterized SQL only — no cross-module code
 * import — and returns raw classifications so the pure policies own every
 * decision. Bounded and deterministically ordered.
 */
@Injectable()
export class RosterSourceRepository {
  async findCandidate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    rosterId: string,
    squadId: string | null,
    membershipId: string,
  ): Promise<RosterCandidate | null> {
    const rows = await scope.run<RosterCandidateRow>(
      `${CANDIDATE_SELECT}
        WHERE m."team_id" = $1 AND m."id" = $5 AND m."deleted_at" IS NULL
          AND (m."season_id" = $2 OR m."season_id" IS NULL)`,
      [teamId, seasonId, rosterId, squadId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : toRosterCandidate(row);
  }

  /**
   * The squad's active selections, as roster candidates. This is the
   * generate-from-squad source: a bounded, ordered page capped at the module's
   * hard expansion ceiling so one call can never fan out without limit.
   */
  async listSquadSelections(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    rosterId: string,
    squadId: string,
  ): Promise<readonly RosterCandidate[]> {
    const rows = await scope.run<RosterCandidateRow>(
      `${CANDIDATE_SELECT}
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND (m."season_id" = $2 OR m."season_id" IS NULL)
          AND m."status" NOT IN ${EXCLUDED_CANDIDATE_STATES}
          AND sel."id" IS NOT NULL
        ORDER BY m."id" ASC
        LIMIT $5`,
      [teamId, seasonId, rosterId, squadId, GENERATE_MAX_ENTRIES],
    );
    return rows.map(row => toRosterCandidate(row));
  }

  /**
   * How many season members hold no active entry on this roster. Feeds the
   * privacy-aware publish audience as a COUNT only — never a list of names.
   */
  async countNotSelected(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    rosterId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "memberships" m
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND (m."season_id" = $2 OR m."season_id" IS NULL)
          AND m."status" NOT IN ${EXCLUDED_CANDIDATE_STATES}
          AND NOT EXISTS (
            SELECT 1 FROM "roster_entries" e
             WHERE e."roster_id" = $3 AND e."membership_id" = m."id"
               AND e."status" = 'selected')`,
      [teamId, seasonId, rosterId],
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * The caller's own membership in this team and season. Availability is always
   * declared for the identity on the token, never for an id in the body.
   */
  async resolveActiveMembership(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    userId: string,
  ): Promise<string | null> {
    const rows = await scope.run<IdRow>(
      `SELECT m."id" FROM "memberships" m
        WHERE m."team_id" = $1 AND m."user_id" = $3 AND m."deleted_at" IS NULL
          AND (m."season_id" = $2 OR m."season_id" IS NULL)
          AND m."status" NOT IN ('archived', 'anonymized', 'left')
        ORDER BY COALESCE(m."season_id" = $2, false) DESC, m."created_at" DESC
        LIMIT 1`,
      [teamId, seasonId, userId],
    );
    const row = rows[0];
    return row === undefined ? null : row.id;
  }
}
