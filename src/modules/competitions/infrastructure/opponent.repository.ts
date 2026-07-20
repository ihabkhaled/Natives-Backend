import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toOpponent } from '../lib/competitions.mapper';
import {
  LIST_MAX_LIMIT,
  OPPONENT_COLUMNS,
} from '../model/competitions.constants';
import type { CountRow, IdRow, OpponentRow } from '../model/competitions.rows';
import type {
  NewOpponent,
  Opponent,
  PageRequest,
} from '../model/competitions.types';

/**
 * Persistence for the opponent catalogue (external teams a team plays). Data
 * access only: parameterized SQL, static column lists, soft-deleted rows excluded,
 * and bounded/ordered reads. A booking references only an active opponent.
 */
@Injectable()
export class OpponentRepository {
  async insert(
    scope: TransactionScope,
    opponent: NewOpponent,
  ): Promise<Opponent | null> {
    const rows = await scope.run<OpponentRow>(
      `INSERT INTO "opponents"
        ("id", "team_id", "name", "short_name", "logo_ref", "contact_name",
         "contact_info", "notes", "status", "created_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $10)
       ON CONFLICT DO NOTHING
       RETURNING ${OPPONENT_COLUMNS}`,
      this.insertParameters(opponent),
    );
    const row = rows[0];
    return row === undefined ? null : toOpponent(row);
  }

  async activeInTeam(
    scope: TransactionScope,
    teamId: string,
    opponentId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "opponents"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL`,
      [opponentId, teamId],
    );
    return rows.length > 0;
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly Opponent[]> {
    const rows = await scope.run<OpponentRow>(
      `SELECT ${OPPONENT_COLUMNS} FROM "opponents"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL
        ORDER BY "name" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toOpponent(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "opponents"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(opponent: NewOpponent): readonly unknown[] {
    const { content } = opponent;
    return [
      opponent.id,
      opponent.teamId,
      content.name,
      content.shortName,
      content.logoRef,
      content.contactName,
      content.contactInfo,
      content.notes,
      opponent.createdBy,
      opponent.now.toISOString(),
    ];
  }
}
