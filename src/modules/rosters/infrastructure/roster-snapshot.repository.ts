import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRosterSnapshot } from '../lib/rosters.mapper';
import { ENTRY_MAX_LIMIT, SNAPSHOT_COLUMNS } from '../model/rosters.constants';
import type { SnapshotReason } from '../model/rosters.enums';
import type { CountRow, RosterSnapshotRow } from '../model/rosters.rows';
import type {
  NewRosterSnapshot,
  PageRequest,
  RosterSnapshot,
} from '../model/rosters.types';

/**
 * Append-only persistence for roster snapshots. There is deliberately NO update
 * and NO delete statement in this repository: a snapshot is written once and read
 * forever, so a later squad or roster change can never rewrite recorded history.
 * The database enforces the same rule with an ON UPDATE DO INSTEAD NOTHING rule.
 */
@Injectable()
export class RosterSnapshotRepository {
  async append(
    scope: TransactionScope,
    snapshot: NewRosterSnapshot,
  ): Promise<RosterSnapshot> {
    const rows = await scope.run<RosterSnapshotRow>(
      `INSERT INTO "roster_snapshots"
        ("id", "roster_id", "team_id", "season_id", "competition_id",
         "fixture_id", "roster_kind", "revision", "reason", "roster_status",
         "entry_count", "checksum", "entries", "taken_by", "taken_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb,
               $14, $15)
       RETURNING ${SNAPSHOT_COLUMNS}`,
      this.appendParameters(snapshot),
    );
    return toRosterSnapshot(this.requireRow(rows));
  }

  async findByRevisionReason(
    scope: TransactionScope,
    rosterId: string,
    revision: number,
    reason: SnapshotReason,
  ): Promise<RosterSnapshot | null> {
    const rows = await scope.run<RosterSnapshotRow>(
      `SELECT ${SNAPSHOT_COLUMNS} FROM "roster_snapshots"
        WHERE "roster_id" = $1 AND "revision" = $2 AND "reason" = $3`,
      [rosterId, revision, reason],
    );
    const row = rows[0];
    return row === undefined ? null : toRosterSnapshot(row);
  }

  /** The most recent snapshot of a roster, or null when it never froze. */
  async findLatest(
    scope: TransactionScope,
    rosterId: string,
  ): Promise<RosterSnapshot | null> {
    const rows = await scope.run<RosterSnapshotRow>(
      `SELECT ${SNAPSHOT_COLUMNS} FROM "roster_snapshots"
        WHERE "roster_id" = $1
        ORDER BY "taken_at" DESC, "id" DESC
        LIMIT 1`,
      [rosterId],
    );
    const row = rows[0];
    return row === undefined ? null : toRosterSnapshot(row);
  }

  async listForRoster(
    scope: TransactionScope,
    rosterId: string,
    page: PageRequest,
  ): Promise<readonly RosterSnapshot[]> {
    const rows = await scope.run<RosterSnapshotRow>(
      `SELECT ${SNAPSHOT_COLUMNS} FROM "roster_snapshots"
        WHERE "roster_id" = $1
        ORDER BY "taken_at" DESC, "id" DESC
        LIMIT $2 OFFSET $3`,
      [rosterId, Math.min(page.limit, ENTRY_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toRosterSnapshot(row));
  }

  async countForRoster(
    scope: TransactionScope,
    rosterId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "roster_snapshots"
        WHERE "roster_id" = $1`,
      [rosterId],
    );
    return rows[0]?.count ?? 0;
  }

  private appendParameters(snapshot: NewRosterSnapshot): readonly unknown[] {
    return [
      snapshot.id,
      snapshot.rosterId,
      snapshot.teamId,
      snapshot.seasonId,
      snapshot.competitionId,
      snapshot.fixtureId,
      snapshot.rosterKind,
      snapshot.revision,
      snapshot.reason,
      snapshot.rosterStatus,
      snapshot.entryCount,
      snapshot.checksum,
      JSON.stringify(snapshot.entries),
      snapshot.takenBy,
      snapshot.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly RosterSnapshotRow[]): RosterSnapshotRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the snapshot write');
    }
    return row;
  }
}
