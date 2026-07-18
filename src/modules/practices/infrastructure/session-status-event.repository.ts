import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseSessionStatus, toDate } from '../lib/practices.helpers';
import { STATUS_EVENT_COLUMNS } from '../model/practices.constants';
import type { StatusEventRow } from '../model/practices.rows';
import type {
  NewStatusEvent,
  SessionStatusEvent,
} from '../model/practices.types';

/**
 * Append-only status-history timeline for practice sessions. Every lifecycle
 * change (publish/reschedule/cancel/reopen) is recorded as an immutable row —
 * never updated or deleted — in the same transaction as the session change it
 * describes. Reads are bounded and deterministically ordered oldest-first, so a
 * cancellation preserves rather than erases the record of what happened.
 */
@Injectable()
export class SessionStatusEventRepository {
  async append(scope: TransactionScope, event: NewStatusEvent): Promise<void> {
    await scope.run(
      `INSERT INTO "practice_session_status_events" ("id", "session_id",
              "from_status", "to_status", "reason", "actor_user_id",
              "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.id,
        event.sessionId,
        event.fromStatus,
        event.toStatus,
        event.reason,
        event.actorUserId,
        event.now.toISOString(),
      ],
    );
  }

  async listBySession(
    scope: TransactionScope,
    sessionId: string,
    limit: number,
  ): Promise<readonly SessionStatusEvent[]> {
    const rows = await scope.run<StatusEventRow>(
      `SELECT ${STATUS_EVENT_COLUMNS} FROM "practice_session_status_events"
        WHERE "session_id" = $1
        ORDER BY "occurred_at" ASC, "id" ASC
        LIMIT $2`,
      [sessionId, limit],
    );
    return rows.map(row => this.toEvent(row));
  }

  private toEvent(row: StatusEventRow): SessionStatusEvent {
    return {
      id: row.id,
      sessionId: row.session_id,
      fromStatus:
        row.from_status === null ? null : parseSessionStatus(row.from_status),
      toStatus: parseSessionStatus(row.to_status),
      reason: row.reason,
      actorUserId: row.actor_user_id,
      occurredAt: toDate(row.occurred_at),
    };
  }
}
