import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toNotification } from '../lib/platform.mapper';
import { NOTIFICATION_COLUMNS } from '../model/platform.constants';
import type { CountRow, NotificationRow } from '../model/platform.rows';
import type {
  NewNotification,
  Notification,
  PagedResult,
  PageRequest,
} from '../model/platform.types';

/**
 * Persistence for the in-app notification inbox. `insert` is dedupe-safe: a unique
 * `dedupe_key` with `ON CONFLICT DO NOTHING` means a retried domain event never
 * creates a second notification (returns null when suppressed). Reads are scoped
 * to the owning user, bounded, and deterministically ordered.
 */
@Injectable()
export class NotificationRepository {
  async insert(
    scope: TransactionScope,
    notification: NewNotification,
  ): Promise<Notification | null> {
    const rows = await scope.run<NotificationRow>(
      `INSERT INTO "notifications" ("id", "user_id", "team_id", "category",
              "event_type", "title_key", "body_key", "params", "dedupe_key",
              "read_at", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NULL, $10)
       ON CONFLICT ("dedupe_key") DO NOTHING
       RETURNING ${NOTIFICATION_COLUMNS}`,
      [
        notification.id,
        notification.userId,
        notification.teamId,
        notification.category,
        notification.eventType,
        notification.titleKey,
        notification.bodyKey,
        JSON.stringify(notification.params),
        notification.dedupeKey,
        notification.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toNotification(row);
  }

  async listForUser(
    scope: TransactionScope,
    userId: string,
    page: PageRequest,
  ): Promise<PagedResult<Notification>> {
    const rows = await scope.run<NotificationRow>(
      `SELECT ${NOTIFICATION_COLUMNS} FROM "notifications"
        WHERE "user_id" = $1
        ORDER BY "created_at" DESC, "id" DESC
        LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "notifications" WHERE "user_id" = $1`,
      [userId],
    );
    return {
      items: rows.map(row => toNotification(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async markRead(
    scope: TransactionScope,
    userId: string,
    id: string,
    now: Date,
  ): Promise<Notification | null> {
    const rows = await scope.run<NotificationRow>(
      `UPDATE "notifications"
          SET "read_at" = COALESCE("read_at", $3)
        WHERE "id" = $1 AND "user_id" = $2
       RETURNING ${NOTIFICATION_COLUMNS}`,
      [id, userId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toNotification(row);
  }
}
