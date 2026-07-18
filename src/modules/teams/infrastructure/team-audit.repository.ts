import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { NewAuditEvent } from '../model/teams.types';

/**
 * Append-only audit for team-configuration writes. Records each create/update/
 * archive as an immutable row in the shared security_events log, in the same
 * transaction as the change it describes, so audit and effect commit atomically.
 */
@Injectable()
export class TeamAuditRepository {
  async append(scope: TransactionScope, event: NewAuditEvent): Promise<void> {
    await scope.run(
      `INSERT INTO "security_events" ("id", "event_type", "actor_user_id",
              "context", "occurred_at")
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [
        event.id,
        event.eventType,
        event.actorUserId,
        JSON.stringify(event.context),
        event.occurredAt.toISOString(),
      ],
    );
  }
}
