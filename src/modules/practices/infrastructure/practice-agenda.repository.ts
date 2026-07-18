import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseAgendaStatus } from '../lib/agendas.helpers';
import { toDate, toNullableDate } from '../lib/practices.helpers';
import { AGENDA_COLUMNS } from '../model/agendas.constants';
import type { AgendaRow } from '../model/agendas.rows';
import type {
  Agenda,
  AgendaLifecycleWrite,
  NewAgenda,
} from '../model/agendas.types';

/**
 * Persistence for the per-session agenda aggregate. Session-scoped, parameterized,
 * static column lists. The insert uses `ON CONFLICT DO NOTHING` on the unique
 * `session_id` so a concurrent duplicate is a clean null; publish/complete are
 * state- and version-guarded; `bumpVersion` gives structural edits and reorders an
 * optimistic-concurrency handle (a stale reorder loses the race and returns null).
 */
@Injectable()
export class PracticeAgendaRepository {
  async insertAgenda(
    scope: TransactionScope,
    agenda: NewAgenda,
  ): Promise<Agenda | null> {
    const rows = await scope.run<AgendaRow>(
      `INSERT INTO "practice_agendas" ("id", "session_id", "team_id",
              "season_id", "theme", "notes", "created_by", "created_at",
              "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT ("session_id") DO NOTHING
       RETURNING ${AGENDA_COLUMNS}`,
      [
        agenda.id,
        agenda.sessionId,
        agenda.teamId,
        agenda.seasonId,
        agenda.theme,
        agenda.notes,
        agenda.createdBy,
        agenda.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAgenda(row);
  }

  async findBySession(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<Agenda | null> {
    const rows = await scope.run<AgendaRow>(
      `SELECT ${AGENDA_COLUMNS} FROM "practice_agendas"
        WHERE "session_id" = $1`,
      [sessionId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAgenda(row);
  }

  async publish(
    scope: TransactionScope,
    write: AgendaLifecycleWrite,
  ): Promise<Agenda | null> {
    const rows = await scope.run<AgendaRow>(
      `UPDATE "practice_agendas"
          SET "status" = 'published', "published_at" = $3, "published_by" = $2,
              "updated_by" = $2, "updated_at" = $3, "version" = "version" + 1
        WHERE "id" = $1 AND "status" = 'draft'
          AND ($4::int IS NULL OR "version" = $4)
       RETURNING ${AGENDA_COLUMNS}`,
      [
        write.id,
        write.actorUserId,
        write.now.toISOString(),
        write.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAgenda(row);
  }

  async complete(
    scope: TransactionScope,
    write: AgendaLifecycleWrite,
  ): Promise<Agenda | null> {
    const rows = await scope.run<AgendaRow>(
      `UPDATE "practice_agendas"
          SET "status" = 'completed', "completed_at" = $3, "completed_by" = $2,
              "updated_by" = $2, "updated_at" = $3, "version" = "version" + 1
        WHERE "id" = $1 AND "status" = 'published'
          AND ($4::int IS NULL OR "version" = $4)
       RETURNING ${AGENDA_COLUMNS}`,
      [
        write.id,
        write.actorUserId,
        write.now.toISOString(),
        write.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAgenda(row);
  }

  async bumpVersion(
    scope: TransactionScope,
    id: string,
    actorUserId: string | null,
    expectedVersion: number | null,
    now: Date,
  ): Promise<Agenda | null> {
    const rows = await scope.run<AgendaRow>(
      `UPDATE "practice_agendas"
          SET "updated_by" = $2, "updated_at" = $3, "version" = "version" + 1
        WHERE "id" = $1 AND ($4::int IS NULL OR "version" = $4)
       RETURNING ${AGENDA_COLUMNS}`,
      [id, actorUserId, now.toISOString(), expectedVersion],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAgenda(row);
  }

  private toAgenda(row: AgendaRow): Agenda {
    return {
      id: row.id,
      sessionId: row.session_id,
      teamId: row.team_id,
      seasonId: row.season_id,
      status: parseAgendaStatus(row.status),
      theme: row.theme,
      notes: row.notes,
      publishedAt: toNullableDate(row.published_at),
      publishedBy: row.published_by,
      completedAt: toNullableDate(row.completed_at),
      completedBy: row.completed_by,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
