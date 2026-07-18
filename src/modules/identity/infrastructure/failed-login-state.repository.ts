import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate, toNullableDate } from '../lib/identity.helpers';
import type { FailedLoginStateRow } from '../model/identity.rows';
import type {
  FailedLoginState,
  FailedLoginUpdate,
  NewFailedLoginState,
} from '../model/identity.types';

/**
 * Per-identity failed-login accounting keyed by normalized email. Locking the
 * row FOR UPDATE serializes concurrent login attempts so the attempt counter and
 * lockout window cannot race.
 */
@Injectable()
export class FailedLoginStateRepository {
  async findByEmailForUpdate(
    scope: TransactionScope,
    normalizedEmail: string,
  ): Promise<FailedLoginState | null> {
    const rows = await scope.run<FailedLoginStateRow>(
      `SELECT "id", "email", "attempt_count", "first_attempt_at", "locked_until"
         FROM "failed_login_state"
        WHERE lower("email") = $1 FOR UPDATE`,
      [normalizedEmail],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      attemptCount: row.attempt_count,
      firstAttemptAt: toDate(row.first_attempt_at),
      lockedUntil: toNullableDate(row.locked_until),
    };
  }

  async insert(
    scope: TransactionScope,
    state: NewFailedLoginState,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "failed_login_state" ("id", "email", "attempt_count",
                                         "first_attempt_at", "locked_until",
                                         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $4)`,
      [
        state.id,
        state.email,
        state.attemptCount,
        state.firstAttemptAt.toISOString(),
        state.lockedUntil === null ? null : state.lockedUntil.toISOString(),
      ],
    );
  }

  async update(
    scope: TransactionScope,
    patch: FailedLoginUpdate,
  ): Promise<void> {
    await scope.run(
      `UPDATE "failed_login_state"
          SET "attempt_count" = $2, "first_attempt_at" = $3,
              "locked_until" = $4, "updated_at" = $5
        WHERE "id" = $1`,
      [
        patch.id,
        patch.attemptCount,
        patch.firstAttemptAt.toISOString(),
        patch.lockedUntil === null ? null : patch.lockedUntil.toISOString(),
        patch.now.toISOString(),
      ],
    );
  }

  async clearByEmail(
    scope: TransactionScope,
    normalizedEmail: string,
  ): Promise<void> {
    await scope.run(
      `DELETE FROM "failed_login_state" WHERE lower("email") = $1`,
      [normalizedEmail],
    );
  }
}
