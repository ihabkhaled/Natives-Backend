import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toSelection } from '../lib/squads.mapper';
import { LIST_MAX_LIMIT, SELECTION_COLUMNS } from '../model/squads.constants';
import type { CountRow, SelectionRow } from '../model/squads.rows';
import type {
  NewSelectionEvent,
  PageRequest,
  SelectionRemoval,
  SelectionWrite,
  SquadSelection,
} from '../model/squads.types';

/**
 * Persistence for squad selections and their append-only history. Data access
 * only: parameterized SQL, static columns, one active selection per member per
 * squad (upsert), soft removal that keeps the row for history, and a bounded,
 * deterministically ordered read.
 */
@Injectable()
export class SquadSelectionRepository {
  async upsert(
    scope: TransactionScope,
    write: SelectionWrite,
  ): Promise<SquadSelection> {
    const rows = await scope.run<SelectionRow>(
      `INSERT INTO "squad_selections"
        ("id", "squad_id", "team_id", "membership_id", "selection_role",
         "status", "reason", "eligibility_overridden", "override_reason",
         "overridden_by", "eligibility_snapshot", "selected_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'selected', $6, $7, $8, $9, $10, $11, $12,
               $12)
       ON CONFLICT ("squad_id", "membership_id") DO UPDATE
          SET "selection_role" = EXCLUDED."selection_role",
              "status" = 'selected',
              "reason" = EXCLUDED."reason",
              "eligibility_overridden" = EXCLUDED."eligibility_overridden",
              "override_reason" = EXCLUDED."override_reason",
              "overridden_by" = EXCLUDED."overridden_by",
              "eligibility_snapshot" = EXCLUDED."eligibility_snapshot",
              "selected_by" = EXCLUDED."selected_by",
              "removed_by" = NULL, "removed_at" = NULL,
              "updated_at" = EXCLUDED."updated_at",
              "record_version" = "squad_selections"."record_version" + 1
       RETURNING ${SELECTION_COLUMNS}`,
      this.upsertParameters(write),
    );
    return toSelection(this.requireRow(rows));
  }

  async softRemove(
    scope: TransactionScope,
    removal: SelectionRemoval,
  ): Promise<SquadSelection | null> {
    const rows = await scope.run<SelectionRow>(
      `UPDATE "squad_selections"
          SET "status" = 'removed', "removed_by" = $3, "removed_at" = $4,
              "reason" = COALESCE($5, "reason"), "updated_at" = $4,
              "record_version" = "record_version" + 1
        WHERE "squad_id" = $1 AND "membership_id" = $2 AND "status" = 'selected'
       RETURNING ${SELECTION_COLUMNS}`,
      [
        removal.squadId,
        removal.membershipId,
        removal.removedBy,
        removal.now.toISOString(),
        removal.reason,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toSelection(row);
  }

  async findActive(
    scope: TransactionScope,
    squadId: string,
    membershipId: string,
  ): Promise<SquadSelection | null> {
    const rows = await scope.run<SelectionRow>(
      `SELECT ${SELECTION_COLUMNS} FROM "squad_selections"
        WHERE "squad_id" = $1 AND "membership_id" = $2 AND "status" = 'selected'`,
      [squadId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : toSelection(row);
  }

  async appendEvent(
    scope: TransactionScope,
    event: NewSelectionEvent,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "squad_selection_events"
        ("id", "squad_id", "membership_id", "event_type", "selection_role",
         "reason", "eligibility_snapshot", "actor_user_id", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.id,
        event.squadId,
        event.membershipId,
        event.eventType,
        event.selectionRole,
        event.reason,
        event.eligibilitySnapshot,
        event.actorUserId,
        event.now.toISOString(),
      ],
    );
  }

  async countActive(scope: TransactionScope, squadId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "squad_selections"
        WHERE "squad_id" = $1 AND "status" = 'selected'`,
      [squadId],
    );
    return rows[0]?.count ?? 0;
  }

  async listForSquad(
    scope: TransactionScope,
    squadId: string,
    page: PageRequest,
  ): Promise<readonly SquadSelection[]> {
    const rows = await scope.run<SelectionRow>(
      `SELECT ${SELECTION_COLUMNS} FROM "squad_selections"
        WHERE "squad_id" = $1
        ORDER BY "status" ASC, "created_at" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [squadId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toSelection(row));
  }

  async countForSquad(
    scope: TransactionScope,
    squadId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "squad_selections"
        WHERE "squad_id" = $1`,
      [squadId],
    );
    return rows[0]?.count ?? 0;
  }

  private upsertParameters(write: SelectionWrite): readonly unknown[] {
    return [
      write.id,
      write.squadId,
      write.teamId,
      write.membershipId,
      write.selectionRole,
      write.reason,
      write.eligibilityOverridden,
      write.overrideReason,
      write.overriddenBy,
      write.eligibilitySnapshot,
      write.selectedBy,
      write.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly SelectionRow[]): SelectionRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the selection write');
    }
    return row;
  }
}
