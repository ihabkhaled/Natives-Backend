import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseBlockType,
  parseCompletionStatus,
  parseNullableIntensity,
} from '../lib/agendas.helpers';
import { toNullableDate } from '../lib/practices.helpers';
import { BLOCK_COLUMNS } from '../model/agendas.constants';
import type {
  AgendaBlockIdRow,
  AgendaBlockRow,
  AgendaCountRow,
} from '../model/agendas.rows';
import type {
  AgendaBlock,
  AgendaBlockUpdate,
  BlockCompletionWrite,
  BlockPositionWrite,
  NewAgendaBlock,
} from '../model/agendas.types';

/**
 * Persistence for ordered agenda blocks. Agenda-scoped, parameterized, bounded,
 * deterministically ordered by position. Reorder is a single set-based UPDATE
 * (unnest of the id + position arrays) so all positions move atomically; updates
 * and completion are optimistic-version guarded.
 */
@Injectable()
export class AgendaBlockRepository {
  async insert(
    scope: TransactionScope,
    block: NewAgendaBlock,
  ): Promise<AgendaBlock> {
    const rows = await scope.run<AgendaBlockRow>(
      `INSERT INTO "practice_agenda_blocks" ("id", "agenda_id", "session_id",
              "team_id", "drill_id", "position", "title", "block_type",
              "offset_minutes", "duration_minutes", "intensity", "repetitions",
              "target", "notes", "coach_notes", "created_by", "created_at",
              "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $17)
       RETURNING ${BLOCK_COLUMNS}`,
      [
        block.id,
        block.agendaId,
        block.sessionId,
        block.teamId,
        block.drillId,
        block.position,
        block.title,
        block.blockType,
        block.offsetMinutes,
        block.durationMinutes,
        block.intensity,
        block.repetitions,
        block.target,
        block.notes,
        block.coachNotes,
        block.createdBy,
        block.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the block insert');
    }
    return this.toBlock(row);
  }

  async findByIdInAgenda(
    scope: TransactionScope,
    agendaId: string,
    id: string,
  ): Promise<AgendaBlock | null> {
    const rows = await scope.run<AgendaBlockRow>(
      `SELECT ${BLOCK_COLUMNS} FROM "practice_agenda_blocks"
        WHERE "id" = $1 AND "agenda_id" = $2`,
      [id, agendaId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toBlock(row);
  }

  async listByAgenda(
    scope: TransactionScope,
    agendaId: string,
    limit: number,
  ): Promise<readonly AgendaBlock[]> {
    const rows = await scope.run<AgendaBlockRow>(
      `SELECT ${BLOCK_COLUMNS} FROM "practice_agenda_blocks"
        WHERE "agenda_id" = $1
        ORDER BY "position" ASC, "id" ASC
        LIMIT $2`,
      [agendaId, limit],
    );
    return rows.map(row => this.toBlock(row));
  }

  async listIdsByAgenda(
    scope: TransactionScope,
    agendaId: string,
    limit: number,
  ): Promise<readonly string[]> {
    const rows = await scope.run<AgendaBlockIdRow>(
      `SELECT "id" FROM "practice_agenda_blocks"
        WHERE "agenda_id" = $1
        ORDER BY "position" ASC, "id" ASC
        LIMIT $2`,
      [agendaId, limit],
    );
    return rows.map(row => row.id);
  }

  async nextPosition(
    scope: TransactionScope,
    agendaId: string,
  ): Promise<number> {
    const rows = await scope.run<AgendaCountRow>(
      `SELECT COALESCE(MAX("position") + 1, 0)::int AS "count"
         FROM "practice_agenda_blocks" WHERE "agenda_id" = $1`,
      [agendaId],
    );
    return rows[0]?.count ?? 0;
  }

  async update(
    scope: TransactionScope,
    update: AgendaBlockUpdate,
  ): Promise<AgendaBlock | null> {
    const rows = await scope.run<AgendaBlockRow>(
      `UPDATE "practice_agenda_blocks"
          SET "drill_id" = $2, "title" = $3, "block_type" = $4,
              "offset_minutes" = $5, "duration_minutes" = $6, "intensity" = $7,
              "repetitions" = $8, "target" = $9, "notes" = $10,
              "coach_notes" = $11, "updated_by" = $12, "updated_at" = $13,
              "version" = "version" + 1
        WHERE "id" = $1 AND ($14::int IS NULL OR "version" = $14)
       RETURNING ${BLOCK_COLUMNS}`,
      [
        update.id,
        update.drillId,
        update.title,
        update.blockType,
        update.offsetMinutes,
        update.durationMinutes,
        update.intensity,
        update.repetitions,
        update.target,
        update.notes,
        update.coachNotes,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toBlock(row);
  }

  async complete(
    scope: TransactionScope,
    write: BlockCompletionWrite,
  ): Promise<AgendaBlock | null> {
    const rows = await scope.run<AgendaBlockRow>(
      `UPDATE "practice_agenda_blocks"
          SET "completion_status" = $2, "completed_at" = $3, "completed_by" = $4,
              "updated_by" = $4, "updated_at" = $5, "version" = "version" + 1
        WHERE "id" = $1 AND ($6::int IS NULL OR "version" = $6)
       RETURNING ${BLOCK_COLUMNS}`,
      [
        write.id,
        write.completionStatus,
        write.completedAt === null ? null : write.completedAt.toISOString(),
        write.completedBy,
        write.now.toISOString(),
        write.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toBlock(row);
  }

  async reposition(
    scope: TransactionScope,
    agendaId: string,
    writes: readonly BlockPositionWrite[],
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "practice_agenda_blocks" AS b
          SET "position" = v."position", "updated_at" = $3
         FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS position)
              AS v
        WHERE b."id" = v.id AND b."agenda_id" = $4`,
      [
        writes.map(write => write.id),
        writes.map(write => write.position),
        now.toISOString(),
        agendaId,
      ],
    );
  }

  async remove(
    scope: TransactionScope,
    agendaId: string,
    id: string,
  ): Promise<boolean> {
    const rows = await scope.run<AgendaBlockIdRow>(
      `DELETE FROM "practice_agenda_blocks"
        WHERE "id" = $1 AND "agenda_id" = $2 RETURNING "id"`,
      [id, agendaId],
    );
    return rows.length > 0;
  }

  private toBlock(row: AgendaBlockRow): AgendaBlock {
    return {
      id: row.id,
      agendaId: row.agenda_id,
      sessionId: row.session_id,
      teamId: row.team_id,
      drillId: row.drill_id,
      position: row.position,
      title: row.title,
      blockType: parseBlockType(row.block_type),
      offsetMinutes: row.offset_minutes,
      durationMinutes: row.duration_minutes,
      intensity: parseNullableIntensity(row.intensity),
      repetitions: row.repetitions,
      target: row.target,
      completionStatus: parseCompletionStatus(row.completion_status),
      completedAt: toNullableDate(row.completed_at),
      completedBy: row.completed_by,
      notes: row.notes,
      coachNotes: row.coach_notes,
      version: row.version,
    };
  }
}
