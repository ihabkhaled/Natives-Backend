import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRoster } from '../lib/rosters.mapper';
import { LIST_MAX_LIMIT, ROSTER_COLUMNS } from '../model/rosters.constants';
import type { CountRow, RosterRow } from '../model/rosters.rows';
import type {
  NewRoster,
  PageRequest,
  Roster,
  RosterListFilter,
  RosterStatusChange,
} from '../model/rosters.types';

/**
 * Persistence for the roster aggregate. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists,
 * optimistic-version-guarded writes, and bounded, deterministically ordered
 * reads with allow-listed filters.
 */
@Injectable()
export class RosterRepository {
  async insert(scope: TransactionScope, roster: NewRoster): Promise<Roster> {
    const rows = await scope.run<RosterRow>(
      `INSERT INTO "rosters"
        ("id", "team_id", "season_id", "competition_id", "fixture_id",
         "squad_id", "source_roster_id", "supersedes_roster_id", "roster_kind",
         "name", "status", "division", "min_size", "max_size", "min_women",
         "require_captain", "policy_version", "selection_deadline", "notes",
         "revision", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12, $13,
               $14, $15, $16, $17, $18, $19, $20, $21, $21)
       RETURNING ${ROSTER_COLUMNS}`,
      this.insertParameters(roster),
    );
    return toRoster(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    rosterId: string,
  ): Promise<Roster | null> {
    const rows = await scope.run<RosterRow>(
      `SELECT ${ROSTER_COLUMNS} FROM "rosters"
        WHERE "id" = $1 AND "team_id" = $2`,
      [rosterId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toRoster(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: RosterStatusChange,
  ): Promise<Roster | null> {
    const rows = await scope.run<RosterRow>(
      `UPDATE "rosters"
          SET "status" = $4, "published_by" = $5, "published_at" = $6,
              "locked_by" = $7, "locked_at" = $8, "revised_by" = $9,
              "revised_at" = $10, "revision_reason" = $11, "archived_at" = $12,
              "updated_at" = $13, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${ROSTER_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toRoster(row);
  }

  /**
   * Point the roster at the snapshot just written. Only the pointer moves — the
   * snapshot row itself is append-only and is never rewritten.
   */
  async attachSnapshot(
    scope: TransactionScope,
    rosterId: string,
    snapshotId: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "rosters"
          SET "current_snapshot_id" = $2, "updated_at" = $3
        WHERE "id" = $1`,
      [rosterId, snapshotId, now.toISOString()],
    );
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: RosterListFilter,
    page: PageRequest,
  ): Promise<readonly Roster[]> {
    const rows = await scope.run<RosterRow>(
      `SELECT ${ROSTER_COLUMNS} FROM "rosters"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "competition_id" = $2)
          AND ($3::uuid IS NULL OR "fixture_id" = $3)
          AND ($4::text IS NULL OR "roster_kind" = $4)
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        teamId,
        filter.competitionId,
        filter.fixtureId,
        filter.rosterKind,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toRoster(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: RosterListFilter,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "rosters"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "competition_id" = $2)
          AND ($3::uuid IS NULL OR "fixture_id" = $3)
          AND ($4::text IS NULL OR "roster_kind" = $4)`,
      [teamId, filter.competitionId, filter.fixtureId, filter.rosterKind],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(roster: NewRoster): readonly unknown[] {
    return [
      roster.id,
      roster.teamId,
      roster.seasonId,
      roster.competitionId,
      roster.fixtureId,
      roster.squadId,
      roster.sourceRosterId,
      roster.supersedesRosterId,
      roster.rosterKind,
      roster.name,
      roster.division,
      roster.minSize,
      roster.maxSize,
      roster.minWomen,
      roster.requireCaptain,
      roster.policyVersion,
      roster.selectionDeadline,
      roster.notes,
      roster.revision,
      roster.createdBy,
      roster.now.toISOString(),
    ];
  }

  private statusParameters(change: RosterStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.publishedBy,
      this.instant(change.publishedAt),
      change.lockedBy,
      this.instant(change.lockedAt),
      change.revisedBy,
      this.instant(change.revisedAt),
      change.revisionReason,
      this.instant(change.archivedAt),
      change.now.toISOString(),
    ];
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }

  private requireRow(rows: readonly RosterRow[]): RosterRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the roster write');
    }
    return row;
  }
}
