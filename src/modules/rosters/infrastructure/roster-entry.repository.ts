import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRosterEntry } from '../lib/rosters.mapper';
import { ENTRY_COLUMNS, ENTRY_MAX_LIMIT } from '../model/rosters.constants';
import type { CountRow, RosterEntryRow } from '../model/rosters.rows';
import type {
  PageRequest,
  RosterEntry,
  RosterEntryRemoval,
  RosterEntryWrite,
} from '../model/rosters.types';

/**
 * Persistence for roster entries. Data access only: parameterized SQL, static
 * columns, one entry per member per roster (upsert reinstates a withdrawn one),
 * soft withdrawal that keeps the row so match history is never deleted, and
 * bounded, deterministically ordered reads.
 */
@Injectable()
export class RosterEntryRepository {
  async upsert(
    scope: TransactionScope,
    write: RosterEntryWrite,
  ): Promise<RosterEntry> {
    const rows = await scope.run<RosterEntryRow>(
      `INSERT INTO "roster_entries"
        ("id", "roster_id", "team_id", "membership_id", "jersey_number",
         "entry_role", "line_assignment", "field_position", "gender_bucket",
         "status", "availability", "selection_reason", "constraint_overridden",
         "override_reason", "overridden_by", "selected_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'selected', $10, $11, $12,
               $13, $14, $15, $16, $16)
       ON CONFLICT ("roster_id", "membership_id") DO UPDATE
          SET "jersey_number" = EXCLUDED."jersey_number",
              "entry_role" = EXCLUDED."entry_role",
              "line_assignment" = EXCLUDED."line_assignment",
              "field_position" = EXCLUDED."field_position",
              "gender_bucket" = EXCLUDED."gender_bucket",
              "status" = 'selected',
              "availability" = EXCLUDED."availability",
              "selection_reason" = EXCLUDED."selection_reason",
              "constraint_overridden" = EXCLUDED."constraint_overridden",
              "override_reason" = EXCLUDED."override_reason",
              "overridden_by" = EXCLUDED."overridden_by",
              "selected_by" = EXCLUDED."selected_by",
              "removed_by" = NULL, "removed_at" = NULL, "removal_reason" = NULL,
              "updated_at" = EXCLUDED."updated_at",
              "record_version" = "roster_entries"."record_version" + 1
       RETURNING ${ENTRY_COLUMNS}`,
      this.upsertParameters(write),
    );
    return toRosterEntry(this.requireRow(rows));
  }

  async softRemove(
    scope: TransactionScope,
    removal: RosterEntryRemoval,
  ): Promise<RosterEntry | null> {
    const rows = await scope.run<RosterEntryRow>(
      `UPDATE "roster_entries"
          SET "status" = 'withdrawn', "removed_by" = $3, "removed_at" = $4,
              "removal_reason" = $5, "updated_at" = $4,
              "record_version" = "record_version" + 1
        WHERE "roster_id" = $1 AND "membership_id" = $2
          AND "status" = 'selected'
       RETURNING ${ENTRY_COLUMNS}`,
      [
        removal.rosterId,
        removal.membershipId,
        removal.removedBy,
        removal.now.toISOString(),
        removal.reason,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toRosterEntry(row);
  }

  /** Every active entry of a roster, ordered so a snapshot is deterministic. */
  async listActive(
    scope: TransactionScope,
    rosterId: string,
  ): Promise<readonly RosterEntry[]> {
    const rows = await scope.run<RosterEntryRow>(
      `SELECT ${ENTRY_COLUMNS} FROM "roster_entries"
        WHERE "roster_id" = $1 AND "status" = 'selected'
        ORDER BY "membership_id" ASC
        LIMIT $2`,
      [rosterId, ENTRY_MAX_LIMIT],
    );
    return rows.map(row => toRosterEntry(row));
  }

  /** The member holding `jerseyNumber` on this roster, or null when free. */
  async findByJersey(
    scope: TransactionScope,
    rosterId: string,
    jerseyNumber: number,
  ): Promise<RosterEntry | null> {
    const rows = await scope.run<RosterEntryRow>(
      `SELECT ${ENTRY_COLUMNS} FROM "roster_entries"
        WHERE "roster_id" = $1 AND "jersey_number" = $2
          AND "status" = 'selected'`,
      [rosterId, jerseyNumber],
    );
    const row = rows[0];
    return row === undefined ? null : toRosterEntry(row);
  }

  async countActive(
    scope: TransactionScope,
    rosterId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "roster_entries"
        WHERE "roster_id" = $1 AND "status" = 'selected'`,
      [rosterId],
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Every entry of a roster — active and withdrawn — so a roster export lists
   * each rostered player exactly once even when they contributed nothing.
   */
  async listForRoster(
    scope: TransactionScope,
    rosterId: string,
    page: PageRequest,
  ): Promise<readonly RosterEntry[]> {
    const rows = await scope.run<RosterEntryRow>(
      `SELECT ${ENTRY_COLUMNS} FROM "roster_entries"
        WHERE "roster_id" = $1
        ORDER BY "status" ASC, "jersey_number" ASC NULLS LAST,
                 "membership_id" ASC
        LIMIT $2 OFFSET $3`,
      [rosterId, Math.min(page.limit, ENTRY_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toRosterEntry(row));
  }

  async countForRoster(
    scope: TransactionScope,
    rosterId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "roster_entries"
        WHERE "roster_id" = $1`,
      [rosterId],
    );
    return rows[0]?.count ?? 0;
  }

  private upsertParameters(write: RosterEntryWrite): readonly unknown[] {
    return [
      write.id,
      write.rosterId,
      write.teamId,
      write.membershipId,
      write.jerseyNumber,
      write.entryRole,
      write.lineAssignment,
      write.fieldPosition,
      write.genderBucket,
      write.availability,
      write.selectionReason,
      write.constraintOverridden,
      write.overrideReason,
      write.overriddenBy,
      write.selectedBy,
      write.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly RosterEntryRow[]): RosterEntryRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the roster entry write');
    }
    return row;
  }
}
