import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMatchPointLineupEntry } from '../lib/matches.mapper';
import {
  MATCH_POINT_LINEUP_COLUMNS,
  STATS_LINEUP_MAX,
} from '../model/matches.constants';
import type { MatchPointLineupRow } from '../model/matches.rows';
import type {
  MatchPointLineupEntry,
  NewMatchPointLineupEntry,
} from '../model/matches.types';

/**
 * Persistence for the line that took the field on a point. Data access only:
 * parameterized SQL, static column lists, bounded and deterministically ordered
 * reads.
 *
 * Lineup rows hang off the point-start fact they were recorded with, so
 * retracting that fact removes the whole line from the derivation without
 * rewriting a single row — which is exactly what makes points-played rebuild
 * identically from a corrected stream.
 */
@Injectable()
export class MatchPointLineupRepository {
  async insert(
    scope: TransactionScope,
    entry: NewMatchPointLineupEntry,
  ): Promise<MatchPointLineupEntry> {
    const rows = await scope.run<MatchPointLineupRow>(
      `INSERT INTO "match_point_lineups"
        ("id", "match_id", "team_id", "play_id", "point_number",
         "membership_id", "roster_entry_id", "puller", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${MATCH_POINT_LINEUP_COLUMNS}`,
      [
        entry.id,
        entry.matchId,
        entry.teamId,
        entry.playId,
        entry.pointNumber,
        entry.membershipId,
        entry.rosterEntryId,
        entry.puller,
        entry.now.toISOString(),
      ],
    );
    return toMatchPointLineupEntry(this.requireRow(rows));
  }

  async listForPlay(
    scope: TransactionScope,
    playId: string,
  ): Promise<readonly MatchPointLineupEntry[]> {
    const rows = await scope.run<MatchPointLineupRow>(
      `SELECT ${MATCH_POINT_LINEUP_COLUMNS} FROM "match_point_lineups"
        WHERE "play_id" = $1
        ORDER BY "membership_id" ASC`,
      [playId],
    );
    return rows.map(row => toMatchPointLineupEntry(row));
  }

  /** Every recorded line of a match — the sole source of points played. */
  async listForMatch(
    scope: TransactionScope,
    matchId: string,
  ): Promise<readonly MatchPointLineupEntry[]> {
    const rows = await scope.run<MatchPointLineupRow>(
      `SELECT ${MATCH_POINT_LINEUP_COLUMNS} FROM "match_point_lineups"
        WHERE "match_id" = $1
        ORDER BY "point_number" ASC, "membership_id" ASC
        LIMIT $2`,
      [matchId, STATS_LINEUP_MAX],
    );
    return rows.map(row => toMatchPointLineupEntry(row));
  }

  private requireRow(
    rows: readonly MatchPointLineupRow[],
  ): MatchPointLineupRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the lineup write');
    }
    return row;
  }
}
