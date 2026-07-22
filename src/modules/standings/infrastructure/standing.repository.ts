import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toStanding } from '../lib/standings.mapper';
import {
  STANDING_COLUMNS,
  STANDING_UPSERT_SQL,
  STANDINGS_MAX_LIMIT,
} from '../model/standings.constants';
import type { StandingRow, StandingsCountRow } from '../model/standings.rows';
import type {
  CompetitionStanding,
  PageRequest,
  StandingListFilter,
  StandingUpsert,
} from '../model/standings.types';

/**
 * Persistence for competition standings. Data access only: parameterized SQL,
 * static column lists, and bounded, deterministically ordered reads.
 *
 * The write is an idempotent upsert keyed by (competition, stage, entrant), so
 * re-running a recompute converges on the same table instead of accumulating
 * duplicate rows — and the stored `rule_version_id` records exactly which rule
 * produced the numbers.
 */
@Injectable()
export class StandingRepository {
  async upsert(
    scope: TransactionScope,
    standing: StandingUpsert,
  ): Promise<CompetitionStanding> {
    const rows = await scope.run<StandingRow>(
      STANDING_UPSERT_SQL,
      this.upsertParameters(standing),
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the standings write');
    }
    return toStanding(row);
  }

  async findById(
    scope: TransactionScope,
    teamId: string,
    standingId: string,
  ): Promise<CompetitionStanding | null> {
    const rows = await scope.run<StandingRow>(
      `SELECT ${STANDING_COLUMNS} FROM "competition_standings"
        WHERE "id" = $1 AND "team_id" = $2`,
      [standingId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toStanding(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: StandingListFilter,
    page: PageRequest,
  ): Promise<readonly CompetitionStanding[]> {
    const rows = await scope.run<StandingRow>(
      `SELECT ${STANDING_COLUMNS} FROM "competition_standings"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "competition_id" = $2)
          AND ($3::uuid IS NULL OR "stage_id" = $3)
          AND ($4::text IS NULL OR "source" = $4)
        ORDER BY "standing_points" DESC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        teamId,
        filter.competitionId,
        filter.stageId,
        filter.source,
        Math.min(page.limit, STANDINGS_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toStanding(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: StandingListFilter,
  ): Promise<number> {
    const rows = await scope.run<StandingsCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "competition_standings"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "competition_id" = $2)
          AND ($3::uuid IS NULL OR "stage_id" = $3)
          AND ($4::text IS NULL OR "source" = $4)`,
      [teamId, filter.competitionId, filter.stageId, filter.source],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private upsertParameters(standing: StandingUpsert): readonly unknown[] {
    return [
      standing.id,
      standing.teamId,
      standing.seasonId,
      standing.competitionId,
      standing.stageId,
      standing.ruleVersionId,
      standing.poolLabel,
      standing.entrantKind,
      standing.opponentId,
      standing.tally.played,
      standing.tally.wins,
      standing.tally.losses,
      standing.tally.ties,
      standing.tally.pointsFor,
      standing.tally.pointsAgainst,
      standing.tally.standingPoints,
      standing.spiritScore,
      standing.finalPlace,
      standing.qualification,
      standing.source,
      standing.sourceReference,
      standing.reconciliationNote,
      standing.recordedBy,
      standing.now.toISOString(),
    ];
  }
}
