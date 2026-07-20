import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toInstant } from '../lib/matches.helpers';
import { toMatchEvent } from '../lib/matches.mapper';
import {
  EVENT_MAX_LIMIT,
  MATCH_EVENT_COLUMNS,
  MATCH_EVENT_NOT_VOIDED,
  MATCH_EVENT_SELECT_COLUMNS,
  MATCH_EVENT_VOIDED_EXPRESSION,
} from '../model/matches.constants';
import type {
  CountRow,
  MatchEventRow,
  TimeoutUsageRow,
} from '../model/matches.rows';
import type {
  MatchEvent,
  NewMatchEvent,
  PageRequest,
  TimeoutUsage,
} from '../model/matches.types';

/**
 * Persistence for the append-only match stream. Data access only: parameterized
 * SQL, static column lists, and bounded, deterministically ordered reads.
 *
 * Rows are never updated — the database enforces that with an ON UPDATE DO
 * INSTEAD NOTHING rule — so `voided` is DERIVED from the existence of a
 * compensating void event rather than stamped onto the original fact.
 */
@Injectable()
export class MatchEventRepository {
  async append(
    scope: TransactionScope,
    event: NewMatchEvent,
  ): Promise<MatchEvent> {
    const rows = await scope.run<MatchEventRow>(
      `INSERT INTO "match_events"
        ("id", "match_id", "team_id", "sequence", "operation_id",
         "request_hash", "event_type", "scoring_side", "points",
         "our_score_after", "opponent_score_after", "period",
         "scorer_membership_id", "assist_membership_id", "voids_event_id",
         "void_reason", "recorded_by", "occurred_at", "recorded_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19)
       RETURNING ${MATCH_EVENT_COLUMNS}, ${MATCH_EVENT_NOT_VOIDED}`,
      this.appendParameters(event),
    );
    return toMatchEvent(this.requireRow(rows));
  }

  /**
   * The fact already stored under a client operation id, if any. This single
   * probe is what makes an offline replay idempotent: the same id resolves to the
   * same authoritative event instead of appending a second one.
   */
  async findByOperationId(
    scope: TransactionScope,
    matchId: string,
    operationId: string,
  ): Promise<MatchEvent | null> {
    const rows = await scope.run<MatchEventRow>(
      `SELECT ${MATCH_EVENT_SELECT_COLUMNS}, ${MATCH_EVENT_VOIDED_EXPRESSION}
         FROM "match_events" e
        WHERE e."match_id" = $1 AND e."operation_id" = $2`,
      [matchId, operationId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchEvent(row);
  }

  async findById(
    scope: TransactionScope,
    matchId: string,
    eventId: string,
  ): Promise<MatchEvent | null> {
    const rows = await scope.run<MatchEventRow>(
      `SELECT ${MATCH_EVENT_SELECT_COLUMNS}, ${MATCH_EVENT_VOIDED_EXPRESSION}
         FROM "match_events" e
        WHERE e."match_id" = $1 AND e."id" = $2`,
      [matchId, eventId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchEvent(row);
  }

  /** The whole stream of a match in recorded order — the audit of the score. */
  async listForMatch(
    scope: TransactionScope,
    matchId: string,
    page: PageRequest,
  ): Promise<readonly MatchEvent[]> {
    const rows = await scope.run<MatchEventRow>(
      `SELECT ${MATCH_EVENT_SELECT_COLUMNS}, ${MATCH_EVENT_VOIDED_EXPRESSION}
         FROM "match_events" e
        WHERE e."match_id" = $1
        ORDER BY e."sequence" ASC
        LIMIT $2 OFFSET $3`,
      [matchId, Math.min(page.limit, EVENT_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toMatchEvent(row));
  }

  async countForMatch(
    scope: TransactionScope,
    matchId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "match_events"
        WHERE "match_id" = $1`,
      [matchId],
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Timeouts already used in a period, per side, excluding any that a later void
   * compensated. The timeout budget is therefore always a projection of the
   * stream, never a stored counter that could drift.
   */
  async countTimeouts(
    scope: TransactionScope,
    matchId: string,
    period: number,
  ): Promise<TimeoutUsage> {
    const rows = await scope.run<TimeoutUsageRow>(
      `SELECT e."scoring_side" AS "scoring_side", COUNT(*)::int AS "count"
         FROM "match_events" e
        WHERE e."match_id" = $1 AND e."period" = $2
          AND e."event_type" = 'timeout'
          AND NOT EXISTS (
            SELECT 1 FROM "match_events" v WHERE v."voids_event_id" = e."id"
          )
        GROUP BY e."scoring_side"`,
      [matchId, period],
    );
    return {
      usedByUs: this.countFor(rows, 'us'),
      usedByThem: this.countFor(rows, 'them'),
    };
  }

  private countFor(rows: readonly TimeoutUsageRow[], side: string): number {
    const row = rows.find(candidate => candidate.scoring_side === side);
    return row === undefined ? 0 : Number(row.count);
  }

  private appendParameters(event: NewMatchEvent): readonly unknown[] {
    return [
      event.id,
      event.matchId,
      event.teamId,
      event.sequence,
      event.operationId,
      event.requestHash,
      event.eventType,
      event.scoringSide,
      event.points,
      event.ourScoreAfter,
      event.opponentScoreAfter,
      event.period,
      event.scorerMembershipId,
      event.assistMembershipId,
      event.voidsEventId,
      event.voidReason,
      event.recordedBy,
      toInstant(event.occurredAt),
      event.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly MatchEventRow[]): MatchEventRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the match event append');
    }
    return row;
  }
}
