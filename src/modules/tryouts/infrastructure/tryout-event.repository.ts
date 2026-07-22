import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toTryoutEvent } from '../lib/tryouts.mapper';
import {
  LIST_MAX_LIMIT,
  TRYOUT_EVENT_COLUMNS,
} from '../model/tryouts.constants';
import type {
  TryoutCountRow,
  TryoutEventRow,
  TryoutIdRow,
} from '../model/tryouts.rows';
import type {
  NewTryoutEvent,
  PageRequest,
  TryoutEvent,
  TryoutEventStatusChange,
} from '../model/tryouts.types';

/**
 * Persistence for tryout events and the team/season/venue scope probes they
 * need. Data access only: parameterized SQL, static column lists,
 * optimistic-version-guarded lifecycle writes, and bounded deterministic reads.
 */
@Injectable()
export class TryoutEventRepository {
  async insert(
    scope: TransactionScope,
    event: NewTryoutEvent,
  ): Promise<TryoutEvent> {
    const rows = await scope.run<TryoutEventRow>(
      `INSERT INTO "tryout_events"
        ("id", "team_id", "season_id", "venue_id", "name", "capacity",
         "registration_opens_at", "registration_closes_at", "starts_at",
         "ends_at", "visibility", "consent_version", "eligibility_note",
         "retention_days", "status", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               'draft', $15, $16, $16)
       RETURNING ${TRYOUT_EVENT_COLUMNS}`,
      [
        event.id,
        event.teamId,
        event.seasonId,
        event.venueId,
        event.name,
        event.capacity,
        event.registrationOpensAt,
        event.registrationClosesAt,
        event.startsAt,
        event.endsAt,
        event.visibility,
        event.consentVersion,
        event.eligibilityNote,
        event.retentionDays,
        event.createdBy,
        event.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the tryout event write');
    }
    return toTryoutEvent(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    eventId: string,
  ): Promise<TryoutEvent | null> {
    const rows = await scope.run<TryoutEventRow>(
      `SELECT ${TRYOUT_EVENT_COLUMNS} FROM "tryout_events"
        WHERE "id" = $1 AND "team_id" = $2`,
      [eventId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toTryoutEvent(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: TryoutEventStatusChange,
  ): Promise<TryoutEvent | null> {
    const rows = await scope.run<TryoutEventRow>(
      `UPDATE "tryout_events"
          SET "status" = $4, "opened_at" = $5, "closed_at" = $6,
              "completed_at" = $7, "cancelled_at" = $8, "updated_at" = $9,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${TRYOUT_EVENT_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        this.instant(change.openedAt),
        this.instant(change.closedAt),
        this.instant(change.completedAt),
        this.instant(change.cancelledAt),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toTryoutEvent(row);
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly TryoutEvent[]> {
    const rows = await scope.run<TryoutEventRow>(
      `SELECT ${TRYOUT_EVENT_COLUMNS} FROM "tryout_events"
        WHERE "team_id" = $1
        ORDER BY "starts_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toTryoutEvent(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<TryoutCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "tryout_events"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<TryoutIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  async seasonExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<boolean> {
    const rows = await scope.run<TryoutIdRow>(
      `SELECT "id" FROM "seasons" WHERE "id" = $1 AND "team_id" = $2`,
      [seasonId, teamId],
    );
    return rows.length > 0;
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }
}
