import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAppointment, toPosition } from '../lib/governance.mapper';
import {
  APPOINTMENT_COLUMNS,
  LIST_MAX_LIMIT,
  POSITION_COLUMNS,
} from '../model/governance.constants';
import type {
  AppointmentRow,
  GovernanceCountRow,
  PositionRow,
} from '../model/governance.rows';
import type {
  GovernanceAppointment,
  GovernancePosition,
  NewGovernanceAppointment,
  NewGovernancePosition,
  PageRequest,
} from '../model/governance.types';

/**
 * Persistence for governance positions and their appointments. Data access
 * only: parameterized SQL, static column lists, bounded reads. A position is a
 * TITLE with no application permission; recording an appointment ends the prior
 * substantive holder so term history is complete without overlap.
 */
@Injectable()
export class GovernanceDirectoryRepository {
  async insertPosition(
    scope: TransactionScope,
    position: NewGovernancePosition,
  ): Promise<GovernancePosition> {
    const rows = await scope.run<PositionRow>(
      `INSERT INTO "governance_positions"
        ("id", "team_id", "position_key", "title", "responsibilities",
         "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT ("team_id", "position_key") DO UPDATE SET
         "title" = EXCLUDED."title",
         "responsibilities" = EXCLUDED."responsibilities",
         "status" = 'active',
         "updated_at" = EXCLUDED."updated_at"
       RETURNING ${POSITION_COLUMNS}`,
      [
        position.id,
        position.teamId,
        position.positionKey,
        position.title,
        position.responsibilities,
        position.createdBy,
        position.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the position write');
    }
    return toPosition(row);
  }

  async findPosition(
    scope: TransactionScope,
    teamId: string,
    positionId: string,
  ): Promise<GovernancePosition | null> {
    const rows = await scope.run<PositionRow>(
      `SELECT ${POSITION_COLUMNS} FROM "governance_positions"
        WHERE "id" = $1 AND "team_id" = $2`,
      [positionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toPosition(row);
  }

  async listPositions(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly GovernancePosition[]> {
    const rows = await scope.run<PositionRow>(
      `SELECT ${POSITION_COLUMNS} FROM "governance_positions"
        WHERE "team_id" = $1
        ORDER BY "position_key" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toPosition(row));
  }

  async countPositions(
    scope: TransactionScope,
    teamId: string,
  ): Promise<number> {
    const rows = await scope.run<GovernanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "governance_positions"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** End the current substantive holder so a new appointment does not overlap. */
  async endActiveAppointments(
    scope: TransactionScope,
    positionId: string,
    endsOn: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "governance_appointments"
          SET "status" = 'ended', "ends_on" = COALESCE("ends_on", $2),
              "updated_at" = $3
        WHERE "position_id" = $1 AND "status" = 'active' AND "acting" = false`,
      [positionId, endsOn, now.toISOString()],
    );
  }

  async insertAppointment(
    scope: TransactionScope,
    appointment: NewGovernanceAppointment,
  ): Promise<GovernanceAppointment> {
    const rows = await scope.run<AppointmentRow>(
      `INSERT INTO "governance_appointments"
        ("id", "team_id", "position_id", "membership_id", "acting",
         "starts_on", "ends_on", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING ${APPOINTMENT_COLUMNS}`,
      [
        appointment.id,
        appointment.teamId,
        appointment.positionId,
        appointment.membershipId,
        appointment.acting,
        appointment.startsOn,
        appointment.endsOn,
        appointment.createdBy,
        appointment.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the appointment write');
    }
    return toAppointment(row);
  }

  async listAppointments(
    scope: TransactionScope,
    positionId: string,
    page: PageRequest,
  ): Promise<readonly GovernanceAppointment[]> {
    const rows = await scope.run<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS} FROM "governance_appointments"
        WHERE "position_id" = $1
        ORDER BY "starts_on" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [positionId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toAppointment(row));
  }
}
