import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { NewSecurityEvent } from '../model/identity.types';

/**
 * Append-only audit log for security-relevant events (login, refresh, reuse,
 * invitation, recovery). Rows are never updated or deleted. The context payload
 * is privacy-safe by construction — callers pass ids and booleans, never emails,
 * tokens, or password material.
 */
@Injectable()
export class SecurityEventRepository {
  async append(
    scope: TransactionScope,
    event: NewSecurityEvent,
  ): Promise<void> {
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
