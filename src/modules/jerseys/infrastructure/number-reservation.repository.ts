import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toReservation } from '../lib/jerseys.mapper';
import {
  LIST_MAX_LIMIT,
  RESERVATION_COLUMNS,
} from '../model/jerseys.constants';
import type { JerseyCountRow, ReservationRow } from '../model/jerseys.rows';
import type {
  NewNumberReservation,
  NumberReservation,
  PageRequest,
  ReservationListFilter,
} from '../model/jerseys.types';

/**
 * Persistence for scoped shirt-number reservations. Data access only:
 * parameterized SQL, static column lists, bounded reads.
 *
 * The active-number uniqueness (team, season, division, number) is enforced by a
 * partial unique index: only one ACTIVE reservation may hold a number, but the
 * released history is retained, so a number's past owners are always
 * recoverable. A release is a soft status change, never a delete.
 */
@Injectable()
export class NumberReservationRepository {
  async insert(
    scope: TransactionScope,
    reservation: NewNumberReservation,
  ): Promise<NumberReservation> {
    const rows = await scope.run<ReservationRow>(
      `INSERT INTO "number_reservations"
        ("id", "team_id", "season_id", "division", "number", "membership_id",
         "printed_name", "normalized_name", "active_from", "created_by",
         "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $9)
       RETURNING ${RESERVATION_COLUMNS}`,
      [
        reservation.id,
        reservation.teamId,
        reservation.seasonId,
        reservation.division,
        reservation.number,
        reservation.membershipId,
        reservation.printedName,
        reservation.normalizedName,
        reservation.now.toISOString(),
        reservation.createdBy,
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the reservation write');
    }
    return toReservation(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    reservationId: string,
  ): Promise<NumberReservation | null> {
    const rows = await scope.run<ReservationRow>(
      `SELECT ${RESERVATION_COLUMNS} FROM "number_reservations"
        WHERE "id" = $1 AND "team_id" = $2`,
      [reservationId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toReservation(row);
  }

  async findActive(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    division: string,
    numberValue: number,
  ): Promise<NumberReservation | null> {
    const rows = await scope.run<ReservationRow>(
      `SELECT ${RESERVATION_COLUMNS} FROM "number_reservations"
        WHERE "team_id" = $1 AND "season_id" = $2 AND "division" = $3
          AND "number" = $4 AND "status" = 'active'
        LIMIT 1`,
      [teamId, seasonId, division, numberValue],
    );
    const row = rows[0];
    return row === undefined ? null : toReservation(row);
  }

  async release(
    scope: TransactionScope,
    teamId: string,
    reservationId: string,
    expectedRecordVersion: number,
    reason: string,
    now: Date,
  ): Promise<NumberReservation | null> {
    const rows = await scope.run<ReservationRow>(
      `UPDATE "number_reservations"
          SET "status" = 'released', "released_at" = $4, "release_reason" = $5,
              "updated_at" = $4, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "status" = 'active'
       RETURNING ${RESERVATION_COLUMNS}`,
      [reservationId, teamId, expectedRecordVersion, now.toISOString(), reason],
    );
    const row = rows[0];
    return row === undefined ? null : toReservation(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ReservationListFilter,
    page: PageRequest,
  ): Promise<readonly NumberReservation[]> {
    const rows = await scope.run<ReservationRow>(
      `SELECT ${RESERVATION_COLUMNS} FROM "number_reservations"
        WHERE ${this.predicate()}
        ORDER BY "number" ASC, "active_from" DESC, "id" ASC
        LIMIT $6 OFFSET $7`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toReservation(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ReservationListFilter,
  ): Promise<number> {
    const rows = await scope.run<JerseyCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "number_reservations"
        WHERE ${this.predicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

  private predicate(): string {
    return `"team_id" = $1
          AND ($2::uuid IS NULL OR "season_id" = $2)
          AND ($3::text IS NULL OR "division" = $3)
          AND ($4::text IS NULL OR "status" = $4)
          AND ($5::uuid IS NULL OR "membership_id" = $5)`;
  }

  private filterParameters(
    teamId: string,
    filter: ReservationListFilter,
  ): readonly unknown[] {
    return [
      teamId,
      filter.seasonId,
      filter.division,
      filter.status,
      filter.membershipId,
    ];
  }
}
