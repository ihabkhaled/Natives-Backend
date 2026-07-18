import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

/**
 * Persistence for password credentials. Stores bcrypt hashes only — never a
 * plaintext password. One row per user (enforced by a unique index); resets
 * replace the hash in place and bump the optimistic version.
 */
@Injectable()
export class PasswordCredentialRepository {
  async insert(
    scope: TransactionScope,
    id: string,
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "password_credentials" ("id", "user_id", "password_hash",
                                           "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $4)`,
      [id, userId, passwordHash, now.toISOString()],
    );
  }

  async replaceForUser(
    scope: TransactionScope,
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "password_credentials"
          SET "password_hash" = $2, "updated_at" = $3, "version" = "version" + 1
        WHERE "user_id" = $1`,
      [userId, passwordHash, now.toISOString()],
    );
  }
}
