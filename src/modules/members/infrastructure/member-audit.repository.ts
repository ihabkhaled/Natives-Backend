import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { NewAuditEvent } from '../model/members.types';

/**
 * Append-only audit for member-lifecycle and privacy-sensitive writes. Records
 * each invite/transition/anonymize/profile/alias/media action as an immutable row
 * in the shared security_events log, in the same transaction as the change it
 * describes, so audit and effect commit atomically. Context is redacted (ids
 * only, never PII).
 */
@Injectable()
export class MemberAuditRepository {
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
