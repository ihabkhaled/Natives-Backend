import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toPreference } from '../lib/platform.mapper';
import { PREFERENCE_COLUMNS } from '../model/platform.constants';
import type { EnabledRow, PreferenceRow } from '../model/platform.rows';
import type { NotificationPreference } from '../model/platform.types';

/**
 * Persistence for per-user notification preferences. Absence means enabled:
 * `isEnabled` defaults to true when no explicit row exists, so a user opts out
 * rather than opting in. Upsert is keyed on (user, category, channel).
 */
@Injectable()
export class NotificationPreferenceRepository {
  async isEnabled(
    scope: TransactionScope,
    userId: string,
    category: string,
    channel: string,
  ): Promise<boolean> {
    const rows = await scope.run<EnabledRow>(
      `SELECT "enabled" FROM "notification_preferences"
        WHERE "user_id" = $1 AND "category" = $2 AND "channel" = $3`,
      [userId, category, channel],
    );
    const row = rows[0];
    return row === undefined ? true : row.enabled;
  }

  async listForUser(
    scope: TransactionScope,
    userId: string,
  ): Promise<readonly NotificationPreference[]> {
    const rows = await scope.run<PreferenceRow>(
      `SELECT ${PREFERENCE_COLUMNS} FROM "notification_preferences"
        WHERE "user_id" = $1
        ORDER BY "category" ASC, "channel" ASC`,
      [userId],
    );
    return rows.map(row => toPreference(row));
  }

  async upsert(
    scope: TransactionScope,
    userId: string,
    preference: NotificationPreference,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "notification_preferences" ("user_id", "category", "channel",
              "enabled", "updated_at")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("user_id", "category", "channel")
       DO UPDATE SET "enabled" = EXCLUDED."enabled", "updated_at" = $5`,
      [
        userId,
        preference.category,
        preference.channel,
        preference.enabled,
        now.toISOString(),
      ],
    );
  }
}
