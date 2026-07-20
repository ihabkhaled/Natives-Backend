import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRound, toStage } from '../lib/competitions.mapper';
import {
  FIRST_ORDINAL,
  ROUND_COLUMNS,
  STAGE_COLUMNS,
} from '../model/competitions.constants';
import type {
  IdRow,
  OrdinalRow,
  RoundRow,
  StageRow,
} from '../model/competitions.rows';
import type {
  NewRound,
  NewStage,
  Round,
  Stage,
} from '../model/competitions.types';

/**
 * Persistence for competition stages and their rounds. Data access only:
 * parameterized SQL, static column lists, next-ordinal computed per parent so a
 * unique-ordinal constraint holds, and bounded/ordered reads.
 */
@Injectable()
export class StageRepository {
  async nextStageOrdinal(
    scope: TransactionScope,
    competitionId: string,
  ): Promise<number> {
    const rows = await scope.run<OrdinalRow>(
      `SELECT COALESCE(MAX("ordinal"), 0) + 1 AS "next_ordinal"
         FROM "competition_stages" WHERE "competition_id" = $1`,
      [competitionId],
    );
    return rows[0]?.next_ordinal ?? FIRST_ORDINAL;
  }

  async insertStage(scope: TransactionScope, stage: NewStage): Promise<Stage> {
    const rows = await scope.run<StageRow>(
      `INSERT INTO "competition_stages"
        ("id", "competition_id", "name", "stage_format", "ordinal",
         "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING ${STAGE_COLUMNS}`,
      [
        stage.id,
        stage.competitionId,
        stage.name,
        stage.stageFormat,
        stage.ordinal,
        stage.now.toISOString(),
      ],
    );
    return toStage(this.requireStage(rows));
  }

  async nextRoundOrdinal(
    scope: TransactionScope,
    stageId: string,
  ): Promise<number> {
    const rows = await scope.run<OrdinalRow>(
      `SELECT COALESCE(MAX("ordinal"), 0) + 1 AS "next_ordinal"
         FROM "competition_rounds" WHERE "stage_id" = $1`,
      [stageId],
    );
    return rows[0]?.next_ordinal ?? FIRST_ORDINAL;
  }

  async insertRound(scope: TransactionScope, round: NewRound): Promise<Round> {
    const rows = await scope.run<RoundRow>(
      `INSERT INTO "competition_rounds"
        ("id", "stage_id", "competition_id", "name", "ordinal", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING ${ROUND_COLUMNS}`,
      [
        round.id,
        round.stageId,
        round.competitionId,
        round.name,
        round.ordinal,
        round.now.toISOString(),
      ],
    );
    return toRound(this.requireRound(rows));
  }

  async stageInCompetition(
    scope: TransactionScope,
    competitionId: string,
    stageId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "competition_stages"
        WHERE "id" = $1 AND "competition_id" = $2`,
      [stageId, competitionId],
    );
    return rows.length > 0;
  }

  async roundInStage(
    scope: TransactionScope,
    competitionId: string,
    stageId: string,
    roundId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "competition_rounds"
        WHERE "id" = $1 AND "stage_id" = $2 AND "competition_id" = $3`,
      [roundId, stageId, competitionId],
    );
    return rows.length > 0;
  }

  async listStages(
    scope: TransactionScope,
    competitionId: string,
  ): Promise<readonly Stage[]> {
    const rows = await scope.run<StageRow>(
      `SELECT ${STAGE_COLUMNS} FROM "competition_stages"
        WHERE "competition_id" = $1
        ORDER BY "ordinal" ASC, "id" ASC`,
      [competitionId],
    );
    return rows.map(row => toStage(row));
  }

  async listRounds(
    scope: TransactionScope,
    competitionId: string,
  ): Promise<readonly Round[]> {
    const rows = await scope.run<RoundRow>(
      `SELECT ${ROUND_COLUMNS} FROM "competition_rounds"
        WHERE "competition_id" = $1
        ORDER BY "stage_id" ASC, "ordinal" ASC, "id" ASC`,
      [competitionId],
    );
    return rows.map(row => toRound(row));
  }

  private requireStage(rows: readonly StageRow[]): StageRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the stage write');
    }
    return row;
  }

  private requireRound(rows: readonly RoundRow[]): RoundRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the round write');
    }
    return row;
  }
}
