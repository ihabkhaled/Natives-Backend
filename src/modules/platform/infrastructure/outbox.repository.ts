import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  toDeadLetter,
  toEventEnvelope,
  toLeasedEvent,
} from '../lib/platform.mapper';
import { OUTBOX_COLUMNS, OUTBOX_WORKER_ID } from '../model/platform.constants';
import type {
  DeadLetterCountRow,
  DeadLetterRow,
  IdRow,
  OutboxEventRow,
  StatusCountRow,
} from '../model/platform.rows';
import type {
  DeadLetter,
  DomainEventEnvelope,
  LeasedEvent,
  PageRequest,
} from '../model/platform.types';

/**
 * Persistence for the transactional outbox. `insert` runs inside the business
 * transaction so event and state change commit atomically (or not at all).
 * `leaseBatch` claims pending or lease-expired rows with `FOR UPDATE SKIP LOCKED`
 * so concurrent workers never double-process. All statements are parameterized
 * with static column lists.
 */
@Injectable()
export class OutboxRepository {
  async insert(
    scope: TransactionScope,
    event: DomainEventEnvelope,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "outbox_events" ("id", "aggregate_type", "aggregate_id",
              "event_type", "event_version", "actor_user_id", "team_id",
              "season_id", "correlation_id", "causation_id", "payload",
              "status", "attempts", "available_at", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
               'pending', 0, $12, $12)`,
      [
        event.eventId,
        event.aggregateType,
        event.aggregateId,
        event.eventType,
        event.eventVersion,
        event.actorUserId,
        event.teamId,
        event.seasonId,
        event.correlationId,
        event.causationId,
        JSON.stringify(event.payload),
        event.occurredAt.toISOString(),
      ],
    );
  }

  async leaseBatch(
    scope: TransactionScope,
    now: Date,
    leaseUntil: Date,
    limit: number,
  ): Promise<readonly LeasedEvent[]> {
    const rows = await scope.run<OutboxEventRow>(
      `UPDATE "outbox_events"
          SET "status" = 'processing', "attempts" = "attempts" + 1,
              "leased_until" = $2, "leased_by" = $3
        WHERE "id" IN (
          SELECT "id" FROM "outbox_events"
           WHERE ("status" = 'pending' AND "available_at" <= $1)
              OR ("status" = 'processing' AND "leased_until" < $1)
           ORDER BY "available_at" ASC, "occurred_at" ASC
           LIMIT $4
           FOR UPDATE SKIP LOCKED
        )
       RETURNING ${OUTBOX_COLUMNS}`,
      [now.toISOString(), leaseUntil.toISOString(), OUTBOX_WORKER_ID, limit],
    );
    return rows.map(row => toLeasedEvent(row));
  }

  async markCompleted(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "outbox_events"
          SET "status" = 'completed', "completed_at" = $2,
              "leased_until" = NULL, "leased_by" = NULL
        WHERE "id" = $1`,
      [id, now.toISOString()],
    );
  }

  async reschedule(
    scope: TransactionScope,
    id: string,
    availableAt: Date,
    lastError: string,
  ): Promise<void> {
    await scope.run(
      `UPDATE "outbox_events"
          SET "status" = 'pending', "available_at" = $2, "last_error" = $3,
              "leased_until" = NULL, "leased_by" = NULL
        WHERE "id" = $1`,
      [id, availableAt.toISOString(), lastError],
    );
  }

  async deadLetter(
    scope: TransactionScope,
    id: string,
    lastError: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "outbox_events"
          SET "status" = 'dead_lettered', "last_error" = $2,
              "completed_at" = $3, "dead_lettered_at" = $3,
              "leased_until" = NULL, "leased_by" = NULL
        WHERE "id" = $1`,
      [id, lastError, now.toISOString()],
    );
  }

  async findById(
    scope: TransactionScope,
    id: string,
  ): Promise<DomainEventEnvelope | null> {
    const rows = await scope.run<OutboxEventRow>(
      `SELECT ${OUTBOX_COLUMNS} FROM "outbox_events" WHERE "id" = $1`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : toEventEnvelope(row);
  }

  async requeue(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `UPDATE "outbox_events"
          SET "status" = 'pending', "available_at" = $2, "attempts" = 0,
              "last_error" = NULL, "completed_at" = NULL,
              "dead_lettered_at" = NULL,
              "leased_until" = NULL, "leased_by" = NULL
        WHERE "id" = $1
       RETURNING "id"`,
      [id, now.toISOString()],
    );
    return rows.length > 0;
  }

  async metrics(scope: TransactionScope): Promise<readonly StatusCountRow[]> {
    return scope.run<StatusCountRow>(
      `SELECT "status", COUNT(*)::int AS "count"
         FROM "outbox_events" GROUP BY "status"`,
    );
  }

  /**
   * Bounded page of dead-lettered events, newest failure first. Rows that were
   * dead-lettered before the timestamp existed fall back to `occurred_at`, so
   * `failedAt` is always a real recorded instant, never NULL and never
   * invented. `last_error` stays inside this boundary — the mapper reduces it
   * to a stable failure code.
   */
  async listDeadLetters(
    scope: TransactionScope,
    page: PageRequest,
  ): Promise<readonly DeadLetter[]> {
    const rows = await scope.run<DeadLetterRow>(
      `SELECT "id", "event_type", "attempts",
              COALESCE("dead_lettered_at", "occurred_at") AS "dead_lettered_at",
              "last_error"
         FROM "outbox_events"
        WHERE "status" = 'dead_lettered'
        ORDER BY COALESCE("dead_lettered_at", "occurred_at") DESC, "id" ASC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    return rows.map(row => toDeadLetter(row));
  }

  async countDeadLetters(scope: TransactionScope): Promise<number> {
    const rows = await scope.run<DeadLetterCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "outbox_events"
        WHERE "status" = 'dead_lettered'`,
    );
    return rows[0]?.count ?? 0;
  }
}
