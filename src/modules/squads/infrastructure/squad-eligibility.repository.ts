import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toEligibilityInputs } from '../lib/squads.mapper';
import {
  CANDIDATE_SELECT,
  ELIGIBILITY_MAX_LIMIT,
  EXCLUDED_CANDIDATE_STATES,
} from '../model/squads.constants';
import type {
  CandidateRow,
  CountRow,
  GenderCountRow,
  IdRow,
} from '../model/squads.rows';
import type {
  EligibilityInputs,
  GenderCount,
  PageRequest,
} from '../model/squads.types';

/**
 * Read-only candidate-pool access for eligibility signals. Reads the shared
 * membership, profile, and attendance tables (no cross-module vendor import — SQL
 * only), returning raw counts so the pure policy owns the null-not-zero decision.
 * Parameterized SQL, static columns, bounded and deterministically ordered.
 */
@Injectable()
export class SquadEligibilityRepository {
  async findCandidate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    squadId: string,
    membershipId: string,
  ): Promise<EligibilityInputs | null> {
    const rows = await scope.run<CandidateRow>(
      `${CANDIDATE_SELECT}
        WHERE m."team_id" = $1 AND m."id" = $4 AND m."deleted_at" IS NULL`,
      [teamId, seasonId, squadId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : toEligibilityInputs(row);
  }

  async listCandidates(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<readonly EligibilityInputs[]> {
    const rows = await scope.run<CandidateRow>(
      `${CANDIDATE_SELECT}
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND (m."season_id" = $2 OR m."season_id" IS NULL)
          AND m."status" NOT IN ${EXCLUDED_CANDIDATE_STATES}
        ORDER BY p."full_name" ASC NULLS LAST, m."id" ASC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        seasonId,
        squadId,
        Math.min(page.limit, ELIGIBILITY_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toEligibilityInputs(row));
  }

  async countCandidates(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "memberships" m
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND (m."season_id" = $2 OR m."season_id" IS NULL)
          AND m."status" NOT IN ${EXCLUDED_CANDIDATE_STATES}`,
      [teamId, seasonId],
    );
    return rows[0]?.count ?? 0;
  }

  async genderCountsForSelected(
    scope: TransactionScope,
    squadId: string,
  ): Promise<readonly GenderCount[]> {
    const rows = await scope.run<GenderCountRow>(
      `SELECT p."gender" AS "gender", COUNT(*)::int AS "count"
        FROM "squad_selections" sel
        LEFT JOIN "member_profiles" p ON p."membership_id" = sel."membership_id"
        WHERE sel."squad_id" = $1 AND sel."status" = 'selected'
        GROUP BY p."gender"`,
      [squadId],
    );
    return rows.map(row => ({ gender: row.gender, count: row.count }));
  }

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
