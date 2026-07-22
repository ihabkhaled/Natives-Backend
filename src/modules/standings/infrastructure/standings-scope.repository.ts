import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toFinalizedMatch } from '../lib/standings.mapper';
import {
  FINALIZED_MATCH_STATUS,
  RECOMPUTE_MAX_MATCHES,
} from '../model/standings.constants';
import type {
  FinalizedMatchRow,
  StandingsIdRow,
  StandingsScopeRow,
} from '../model/standings.rows';
import type { FinalizedMatchResult } from '../model/standings.types';

/**
 * Read-only scope resolution and the finalized-result projection a standings
 * recompute folds. Parameterized SQL, static column lists, bounded reads. Only
 * FINALIZED matches are ever projected: a live or abandoned match must not move
 * a standings table, and no personal data crosses this boundary.
 */
@Injectable()
export class StandingsScopeRepository {
  async resolveCompetitionScope(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<StandingsScopeRow | null> {
    const rows = await scope.run<StandingsScopeRow>(
      `SELECT c."id" AS "competition_id", c."season_id" AS "season_id"
         FROM "competitions" c
        WHERE c."id" = $1 AND c."team_id" = $2 AND c."deleted_at" IS NULL`,
      [competitionId, teamId],
    );
    return rows[0] ?? null;
  }

  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<StandingsIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  async stageExistsInCompetition(
    scope: TransactionScope,
    competitionId: string,
    stageId: string,
  ): Promise<boolean> {
    const rows = await scope.run<StandingsIdRow>(
      `SELECT "id" FROM "competition_stages"
        WHERE "id" = $1 AND "competition_id" = $2`,
      [stageId, competitionId],
    );
    return rows.length > 0;
  }

  async opponentExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    opponentId: string,
  ): Promise<boolean> {
    const rows = await scope.run<StandingsIdRow>(
      `SELECT "id" FROM "opponents"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [opponentId, teamId],
    );
    return rows.length > 0;
  }

  /** Every finalized match of a competition, reduced to standings facts. */
  async listFinalizedResults(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<readonly FinalizedMatchResult[]> {
    const rows = await scope.run<FinalizedMatchRow>(
      `SELECT m."id" AS "match_id",
              m."competition_id" AS "competition_id",
              f."stage_id" AS "stage_id",
              f."opponent_id" AS "opponent_id",
              m."our_score" AS "our_score",
              m."opponent_score" AS "opponent_score",
              m."result" AS "result"
         FROM "matches" m
         JOIN "fixtures" f ON f."id" = m."fixture_id"
        WHERE m."team_id" = $1 AND m."competition_id" = $2
          AND m."status" = '${FINALIZED_MATCH_STATUS}'
        ORDER BY m."finalized_at" ASC, m."id" ASC
        LIMIT $3`,
      [teamId, competitionId, RECOMPUTE_MAX_MATCHES],
    );
    return rows.map(row => toFinalizedMatch(row));
  }
}
