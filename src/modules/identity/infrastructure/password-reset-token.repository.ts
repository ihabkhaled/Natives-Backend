import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate, toNullableDate } from '../lib/identity.helpers';
import type { PasswordResetTokenRow } from '../model/identity.rows';
import type {
  NewPasswordResetToken,
  PasswordResetToken,
} from '../model/identity.types';

/**
 * Persistence for password-reset tokens. Stores the sha-256 hash only; the
 * plaintext token is delivered out-of-band. Consumption locks the row FOR UPDATE
 * so a token can be redeemed exactly once even under concurrent requests.
 */
@Injectable()
export class PasswordResetTokenRepository {
  async insert(
    scope: TransactionScope,
    token: NewPasswordResetToken,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "password_reset_tokens" ("id", "user_id", "token_hash",
                                            "expires_at", "created_at")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        token.id,
        token.userId,
        token.tokenHash,
        token.expiresAt.toISOString(),
        token.now.toISOString(),
      ],
    );
  }

  async findByTokenHashForUpdate(
    scope: TransactionScope,
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    const rows = await scope.run<PasswordResetTokenRow>(
      `SELECT "id", "user_id", "expires_at", "consumed_at"
         FROM "password_reset_tokens"
        WHERE "token_hash" = $1 FOR UPDATE`,
      [tokenHash],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: toDate(row.expires_at),
      consumedAt: toNullableDate(row.consumed_at),
    };
  }

  async markConsumed(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "password_reset_tokens"
          SET "consumed_at" = $2
        WHERE "id" = $1 AND "consumed_at" IS NULL`,
      [id, now.toISOString()],
    );
  }
}
