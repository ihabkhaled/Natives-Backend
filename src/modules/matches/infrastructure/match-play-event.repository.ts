import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toInstant } from '../lib/matches.helpers';
import { toMatchPlayEvent, toOpenMatchPoint } from '../lib/matches.mapper';
import {
  MATCH_PLAY_COLUMNS,
  MATCH_PLAY_NOT_RETRACTED,
  MATCH_PLAY_RETRACTED_EXPRESSION,
  MATCH_PLAY_SELECT_COLUMNS,
  PLAY_MAX_LIMIT,
  STATS_PLAY_MAX,
} from '../model/matches.constants';
import type {
  CountRow,
  MatchPlayEventRow,
  NumberRow,
  OpenMatchPointRow,
} from '../model/matches.rows';
import type {
  MatchPlayEvent,
  NewMatchPlayEvent,
  OpenMatchPoint,
  PageRequest,
} from '../model/matches.types';

/**
 * Persistence for the append-only point/possession stream. Data access only:
 * parameterized SQL, static column lists, and bounded, deterministically ordered
 * reads.
 *
 * Rows are never updated — an ON UPDATE DO INSTEAD NOTHING rule enforces that in
 * the database — so `retracted` is DERIVED from the existence of a compensating
 * `correction` pointing back at the row rather than stamped onto history.
 */
@Injectable()
export class MatchPlayEventRepository {
  async append(
    scope: TransactionScope,
    play: NewMatchPlayEvent,
  ): Promise<MatchPlayEvent> {
    const rows = await scope.run<MatchPlayEventRow>(
      `INSERT INTO "match_play_events"
        ("id", "match_id", "team_id", "sequence", "operation_id",
         "request_hash", "play_type", "point_number", "period", "starting_line",
         "scoring_side", "primary_membership_id", "secondary_membership_id",
         "assist_state", "callahan", "duration_seconds", "corrects_play_id",
         "correction_reason", "notes", "recorded_by", "occurred_at",
         "recorded_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20, $21, $22)
       RETURNING ${MATCH_PLAY_COLUMNS}, ${MATCH_PLAY_NOT_RETRACTED}`,
      this.appendParameters(play),
    );
    return toMatchPlayEvent(this.requireRow(rows));
  }

  /**
   * The fact already stored under a client operation id, if any. This single
   * probe is what makes an offline replay idempotent: the same id resolves to
   * the same authoritative fact instead of appending a second one.
   */
  async findByOperationId(
    scope: TransactionScope,
    matchId: string,
    operationId: string,
  ): Promise<MatchPlayEvent | null> {
    const rows = await scope.run<MatchPlayEventRow>(
      `SELECT ${MATCH_PLAY_SELECT_COLUMNS}, ${MATCH_PLAY_RETRACTED_EXPRESSION}
         FROM "match_play_events" p
        WHERE p."match_id" = $1 AND p."operation_id" = $2`,
      [matchId, operationId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchPlayEvent(row);
  }

  async findById(
    scope: TransactionScope,
    matchId: string,
    playId: string,
  ): Promise<MatchPlayEvent | null> {
    const rows = await scope.run<MatchPlayEventRow>(
      `SELECT ${MATCH_PLAY_SELECT_COLUMNS}, ${MATCH_PLAY_RETRACTED_EXPRESSION}
         FROM "match_play_events" p
        WHERE p."match_id" = $1 AND p."id" = $2`,
      [matchId, playId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchPlayEvent(row);
  }

  /** The sequence the next appended fact takes on this match's point stream. */
  async nextSequence(
    scope: TransactionScope,
    matchId: string,
  ): Promise<number> {
    const rows = await scope.run<NumberRow>(
      `SELECT COALESCE(MAX("sequence"), 0) AS "value"
         FROM "match_play_events" WHERE "match_id" = $1`,
      [matchId],
    );
    return Number(rows[0]?.value ?? 0) + 1;
  }

  /**
   * How many point-starts a correction has NOT retracted. The next point takes
   * one past this, so retracting a start and re-recording it reuses the same
   * point number and the corrected stream groups exactly like a clean one.
   */
  async countEffectiveStarts(
    scope: TransactionScope,
    matchId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "match_play_events" p
        WHERE p."match_id" = $1 AND p."play_type" = 'point_started'
          AND NOT EXISTS (
            SELECT 1 FROM "match_play_events" c
             WHERE c."corrects_play_id" = p."id"
          )`,
      [matchId],
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * The point currently open: the highest-numbered point-start that still
   * counts and that no completion (that still counts) has closed.
   */
  async findOpenPoint(
    scope: TransactionScope,
    matchId: string,
  ): Promise<OpenMatchPoint | null> {
    const rows = await scope.run<OpenMatchPointRow>(
      `SELECT p."id", p."point_number", p."period", p."starting_line"
         FROM "match_play_events" p
        WHERE p."match_id" = $1 AND p."play_type" = 'point_started'
          AND NOT EXISTS (
            SELECT 1 FROM "match_play_events" c
             WHERE c."corrects_play_id" = p."id"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "match_play_events" d
             WHERE d."match_id" = p."match_id"
               AND d."play_type" = 'point_completed'
               AND d."point_number" = p."point_number"
               AND NOT EXISTS (
                 SELECT 1 FROM "match_play_events" e
                  WHERE e."corrects_play_id" = d."id"
               )
          )
        ORDER BY p."point_number" DESC, p."sequence" DESC
        LIMIT 1`,
      [matchId],
    );
    const row = rows[0];
    return row === undefined ? null : toOpenMatchPoint(row);
  }

  /** The whole recorded point stream of a match, in sequence order. */
  async listForMatch(
    scope: TransactionScope,
    matchId: string,
    page: PageRequest,
  ): Promise<readonly MatchPlayEvent[]> {
    const rows = await scope.run<MatchPlayEventRow>(
      `SELECT ${MATCH_PLAY_SELECT_COLUMNS}, ${MATCH_PLAY_RETRACTED_EXPRESSION}
         FROM "match_play_events" p
        WHERE p."match_id" = $1
        ORDER BY p."sequence" ASC
        LIMIT $2 OFFSET $3`,
      [matchId, Math.min(page.limit, PLAY_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toMatchPlayEvent(row));
  }

  /** The bounded stream read the statistics projection folds. */
  async listAllForMatch(
    scope: TransactionScope,
    matchId: string,
  ): Promise<readonly MatchPlayEvent[]> {
    const rows = await scope.run<MatchPlayEventRow>(
      `SELECT ${MATCH_PLAY_SELECT_COLUMNS}, ${MATCH_PLAY_RETRACTED_EXPRESSION}
         FROM "match_play_events" p
        WHERE p."match_id" = $1
        ORDER BY p."sequence" ASC
        LIMIT $2`,
      [matchId, STATS_PLAY_MAX],
    );
    return rows.map(row => toMatchPlayEvent(row));
  }

  async countForMatch(
    scope: TransactionScope,
    matchId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "match_play_events"
        WHERE "match_id" = $1`,
      [matchId],
    );
    return rows[0]?.count ?? 0;
  }

  private appendParameters(play: NewMatchPlayEvent): readonly unknown[] {
    return [
      play.id,
      play.matchId,
      play.teamId,
      play.sequence,
      play.operationId,
      play.requestHash,
      play.playType,
      play.pointNumber,
      play.period,
      play.startingLine,
      play.scoringSide,
      play.primaryMembershipId,
      play.secondaryMembershipId,
      play.assistState,
      play.callahan,
      play.durationSeconds,
      play.correctsPlayId,
      play.correctionReason,
      play.notes,
      play.recordedBy,
      toInstant(play.occurredAt),
      play.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly MatchPlayEventRow[]): MatchPlayEventRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the match play append');
    }
    return row;
  }
}
