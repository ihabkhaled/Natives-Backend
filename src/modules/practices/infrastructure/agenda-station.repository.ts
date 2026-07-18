import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseCompletionStatus } from '../lib/agendas.helpers';
import { STATION_COLUMNS } from '../model/agendas.constants';
import type {
  AgendaBlockIdRow,
  AgendaCountRow,
  AgendaStationRow,
} from '../model/agendas.rows';
import type { AgendaStation, NewAgendaStation } from '../model/agendas.types';

/**
 * Persistence for stations nested under an agenda block. Block/agenda-scoped,
 * parameterized, bounded, deterministically ordered by position. Stations carry an
 * optional drill/group/coach assignment; deleting a group or drill only nulls the
 * reference (ON DELETE SET NULL), keeping the station intact.
 */
@Injectable()
export class AgendaStationRepository {
  async insert(
    scope: TransactionScope,
    station: NewAgendaStation,
  ): Promise<AgendaStation> {
    const rows = await scope.run<AgendaStationRow>(
      `INSERT INTO "practice_agenda_stations" ("id", "block_id", "agenda_id",
              "team_id", "drill_id", "group_id", "coach_membership_id",
              "position", "name", "repetitions", "target", "notes",
              "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       RETURNING ${STATION_COLUMNS}`,
      [
        station.id,
        station.blockId,
        station.agendaId,
        station.teamId,
        station.drillId,
        station.groupId,
        station.coachMembershipId,
        station.position,
        station.name,
        station.repetitions,
        station.target,
        station.notes,
        station.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the station insert');
    }
    return this.toStation(row);
  }

  async listByAgenda(
    scope: TransactionScope,
    agendaId: string,
    limit: number,
  ): Promise<readonly AgendaStation[]> {
    const rows = await scope.run<AgendaStationRow>(
      `SELECT ${STATION_COLUMNS} FROM "practice_agenda_stations"
        WHERE "agenda_id" = $1
        ORDER BY "block_id" ASC, "position" ASC, "id" ASC
        LIMIT $2`,
      [agendaId, limit],
    );
    return rows.map(row => this.toStation(row));
  }

  async nextPosition(
    scope: TransactionScope,
    blockId: string,
  ): Promise<number> {
    const rows = await scope.run<AgendaCountRow>(
      `SELECT COALESCE(MAX("position") + 1, 0)::int AS "count"
         FROM "practice_agenda_stations" WHERE "block_id" = $1`,
      [blockId],
    );
    return rows[0]?.count ?? 0;
  }

  async remove(
    scope: TransactionScope,
    blockId: string,
    id: string,
  ): Promise<boolean> {
    const rows = await scope.run<AgendaBlockIdRow>(
      `DELETE FROM "practice_agenda_stations"
        WHERE "id" = $1 AND "block_id" = $2 RETURNING "id"`,
      [id, blockId],
    );
    return rows.length > 0;
  }

  private toStation(row: AgendaStationRow): AgendaStation {
    return {
      id: row.id,
      blockId: row.block_id,
      agendaId: row.agenda_id,
      teamId: row.team_id,
      drillId: row.drill_id,
      groupId: row.group_id,
      coachMembershipId: row.coach_membership_id,
      position: row.position,
      name: row.name,
      repetitions: row.repetitions,
      target: row.target,
      notes: row.notes,
      completionStatus: parseCompletionStatus(row.completion_status),
      version: row.version,
    };
  }
}
