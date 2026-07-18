import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toIdempotencyRecord } from '../lib/platform.mapper';
import { IDEMPOTENCY_COLUMNS } from '../model/platform.constants';
import type { IdempotencyRow } from '../model/platform.rows';
import type {
  IdempotencyRecord,
  NewIdempotencyRecord,
  ScalarPayload,
} from '../model/platform.types';

/**
 * Persistence for idempotency records. A record captures the key, the request
 * hash, the principal + scope, and the eventual result/status. `insertInProgress`
 * shares the caller's transaction so a replay or mismatch is detected atomically
 * with the guarded operation. A unique (key, principal) index rejects concurrent
 * first-writers at the database.
 */
@Injectable()
export class IdempotencyRepository {
  async findByKey(
    scope: TransactionScope,
    key: string,
    principalUserId: string,
  ): Promise<IdempotencyRecord | null> {
    const rows = await scope.run<IdempotencyRow>(
      `SELECT ${IDEMPOTENCY_COLUMNS} FROM "idempotency_records"
        WHERE "idempotency_key" = $1 AND "principal_user_id" = $2`,
      [key, principalUserId],
    );
    const row = rows[0];
    return row === undefined ? null : toIdempotencyRecord(row);
  }

  async insertInProgress(
    scope: TransactionScope,
    record: NewIdempotencyRecord,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "idempotency_records" ("id", "idempotency_key",
              "request_hash", "principal_user_id", "scope_key", "status",
              "status_code", "result", "expires_at", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'in_progress', NULL, NULL, $6, $7, $7)`,
      [
        record.id,
        record.key,
        record.requestHash,
        record.principalUserId,
        record.scopeKey,
        record.expiresAt.toISOString(),
        record.now.toISOString(),
      ],
    );
  }

  async complete(
    scope: TransactionScope,
    id: string,
    statusCode: number,
    result: ScalarPayload,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "idempotency_records"
          SET "status" = 'completed', "status_code" = $2, "result" = $3::jsonb,
              "updated_at" = $4
        WHERE "id" = $1`,
      [id, statusCode, JSON.stringify(result), now.toISOString()],
    );
  }
}
