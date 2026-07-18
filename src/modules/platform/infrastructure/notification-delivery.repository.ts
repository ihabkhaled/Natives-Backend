import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { NewDelivery } from '../model/platform.types';

/**
 * Append-only record of notification delivery attempts per channel. Each attempt
 * captures the resolved status (sent/failed) and any redacted error, giving an
 * auditable delivery trail without mutating prior attempts.
 */
@Injectable()
export class NotificationDeliveryRepository {
  async insert(scope: TransactionScope, delivery: NewDelivery): Promise<void> {
    await scope.run(
      `INSERT INTO "notification_deliveries" ("id", "notification_id", "channel",
              "status", "last_error", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        delivery.id,
        delivery.notificationId,
        delivery.channel,
        delivery.status,
        delivery.lastError,
        delivery.now.toISOString(),
      ],
    );
  }
}
