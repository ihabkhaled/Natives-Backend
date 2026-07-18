import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { QUIET_HOURS_COLUMNS } from '../model/platform.constants';
import type { QuietHoursRow } from '../model/platform.rows';
import type { NotificationQuietHours } from '../model/platform.types';

@Injectable()
export class NotificationQuietHoursRepository {
  async findForUser(
    scope: TransactionScope,
    userId: string,
  ): Promise<NotificationQuietHours | null> {
    const rows = await scope.run<QuietHoursRow>(
      `SELECT ${QUIET_HOURS_COLUMNS} FROM "notification_quiet_hours"
        WHERE "user_id" = $1
        LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toDomain(row);
  }

  async upsert(
    scope: TransactionScope,
    value: NotificationQuietHours,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "notification_quiet_hours" ("user_id", "timezone",
              "starts_local", "ends_local", "urgent_cancellation_override",
              "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("user_id") DO UPDATE SET
         "timezone" = EXCLUDED."timezone",
         "starts_local" = EXCLUDED."starts_local",
         "ends_local" = EXCLUDED."ends_local",
         "urgent_cancellation_override" =
           EXCLUDED."urgent_cancellation_override",
         "updated_at" = EXCLUDED."updated_at"`,
      [
        value.userId,
        value.timezone,
        value.startsLocal,
        value.endsLocal,
        value.urgentCancellationOverride,
        now.toISOString(),
      ],
    );
  }

  private toDomain(row: QuietHoursRow): NotificationQuietHours {
    return {
      userId: row.user_id,
      timezone: row.timezone,
      startsLocal: row.starts_local,
      endsLocal: row.ends_local,
      urgentCancellationOverride: row.urgent_cancellation_override,
    };
  }
}
