import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toStatusEvent } from '../lib/members.helpers';
import { STATUS_EVENT_COLUMNS } from '../model/members.constants';
import type { StatusEventRow } from '../model/members.rows';
import type {
  MembershipStatusEvent,
  NewStatusEvent,
} from '../model/members.types';

/**
 * Append-only status-history timeline for memberships. Every lifecycle
 * transition is recorded as an immutable row (never updated or deleted), in the
 * same transaction as the membership change it describes. Reads are bounded and
 * deterministically ordered oldest-first.
 */
@Injectable()
export class StatusEventRepository {
  async append(scope: TransactionScope, event: NewStatusEvent): Promise<void> {
    await scope.run(
      `INSERT INTO "membership_status_events" ("id", "membership_id",
              "from_status", "to_status", "reason", "actor_user_id",
              "effective_at", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.id,
        event.membershipId,
        event.fromStatus,
        event.toStatus,
        event.reason,
        event.actorUserId,
        event.effectiveAt.toISOString(),
        event.now.toISOString(),
      ],
    );
  }

  async listByMembership(
    scope: TransactionScope,
    membershipId: string,
    limit: number,
  ): Promise<readonly MembershipStatusEvent[]> {
    const rows = await scope.run<StatusEventRow>(
      `SELECT ${STATUS_EVENT_COLUMNS} FROM "membership_status_events"
        WHERE "membership_id" = $1
        ORDER BY "occurred_at" ASC, "id" ASC
        LIMIT $2`,
      [membershipId, limit],
    );
    return rows.map(row => toStatusEvent(row));
  }
}
