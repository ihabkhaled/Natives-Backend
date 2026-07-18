import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { firstRow, toDate, toNullableDate } from '../lib/identity.helpers';
import {
  SESSION_LIST_DEFAULT_OFFSET,
  SESSION_LIST_MAX_LIMIT,
  SESSION_LIST_MIN_LIMIT,
} from '../model/identity.constants';
import type {
  CountRow,
  IdentifierRow,
  RefreshSessionRow,
} from '../model/identity.rows';
import type {
  NewRefreshSession,
  RefreshSession,
  RefreshSessionPage,
  SessionListQuery,
} from '../model/identity.types';

/**
 * Persistence for refresh sessions. Stores the sha-256 token hash only. Rotation
 * revokes the presented row and inserts a successor in the same token family;
 * reuse of an already-rotated token revokes the entire family. Row lookups lock
 * FOR UPDATE so rotation and reuse detection are race-safe.
 */
@Injectable()
export class RefreshSessionRepository {
  private readonly columns = `"id", "user_id", "family_id", "device_label",
    "issued_at", "expires_at", "rotated_at", "revoked_at", "reuse_detected_at"`;

  async insert(
    scope: TransactionScope,
    session: NewRefreshSession,
  ): Promise<RefreshSession> {
    const rows = await scope.run<RefreshSessionRow>(
      `INSERT INTO "refresh_sessions" ("id", "user_id", "token_hash",
                                       "family_id", "device_label", "issued_at",
                                       "expires_at", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $6)
       RETURNING ${this.columns}`,
      [
        session.id,
        session.userId,
        session.tokenHash,
        session.familyId,
        session.deviceLabel,
        session.issuedAt.toISOString(),
        session.expiresAt.toISOString(),
      ],
    );
    return this.toSession(firstRow(rows));
  }

  async findByTokenHashForUpdate(
    scope: TransactionScope,
    tokenHash: string,
  ): Promise<RefreshSession | null> {
    const rows = await scope.run<RefreshSessionRow>(
      `SELECT ${this.columns} FROM "refresh_sessions"
        WHERE "token_hash" = $1 FOR UPDATE`,
      [tokenHash],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSession(row);
  }

  async markRotated(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "refresh_sessions"
          SET "rotated_at" = $2, "revoked_at" = $2
        WHERE "id" = $1`,
      [id, now.toISOString()],
    );
  }

  async revokeById(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "refresh_sessions"
          SET "revoked_at" = $2
        WHERE "id" = $1 AND "revoked_at" IS NULL`,
      [id, now.toISOString()],
    );
  }

  async revokeFamilyForReuse(
    scope: TransactionScope,
    familyId: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "refresh_sessions"
          SET "revoked_at" = COALESCE("revoked_at", $2),
              "reuse_detected_at" = $2
        WHERE "family_id" = $1`,
      [familyId, now.toISOString()],
    );
  }

  async revokeAllForUser(
    scope: TransactionScope,
    userId: string,
    now: Date,
  ): Promise<number> {
    const rows = await scope.run<RefreshSessionRow>(
      `UPDATE "refresh_sessions"
          SET "revoked_at" = $2
        WHERE "user_id" = $1 AND "revoked_at" IS NULL
        RETURNING ${this.columns}`,
      [userId, now.toISOString()],
    );
    return rows.length;
  }

  async listActiveForUser(
    scope: TransactionScope,
    userId: string,
    now: Date,
    query: SessionListQuery,
  ): Promise<RefreshSessionPage> {
    const limit = Math.min(
      Math.max(query.limit, SESSION_LIST_MIN_LIMIT),
      SESSION_LIST_MAX_LIMIT,
    );
    const offset = Math.max(query.offset, SESSION_LIST_DEFAULT_OFFSET);
    const countRows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "refresh_sessions"
        WHERE "user_id" = $1
          AND "revoked_at" IS NULL
          AND "expires_at" > $2`,
      [userId, now.toISOString()],
    );
    const rows = await scope.run<RefreshSessionRow>(
      `SELECT ${this.columns} FROM "refresh_sessions"
        WHERE "user_id" = $1
          AND "revoked_at" IS NULL
          AND "expires_at" > $2
        ORDER BY "issued_at" DESC, "id" ASC
        LIMIT $3 OFFSET $4`,
      [userId, now.toISOString(), limit, offset],
    );
    return {
      items: rows.map(row => this.toSession(row)),
      total: firstRow(countRows).count,
    };
  }

  async revokeOwnedById(
    scope: TransactionScope,
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<IdentifierRow>(
      `UPDATE "refresh_sessions"
          SET "revoked_at" = $3
        WHERE "id" = $1 AND "user_id" = $2 AND "revoked_at" IS NULL
        RETURNING "id"`,
      [sessionId, userId, now.toISOString()],
    );
    return rows.length > 0;
  }

  async revokeOthersForUser(
    scope: TransactionScope,
    userId: string,
    currentSessionId: string,
    now: Date,
  ): Promise<number> {
    const rows = await scope.run<IdentifierRow>(
      `UPDATE "refresh_sessions"
          SET "revoked_at" = $3
        WHERE "user_id" = $1 AND "id" <> $2 AND "revoked_at" IS NULL
        RETURNING "id"`,
      [userId, currentSessionId, now.toISOString()],
    );
    return rows.length;
  }

  private toSession(row: RefreshSessionRow): RefreshSession {
    return {
      id: row.id,
      userId: row.user_id,
      familyId: row.family_id,
      deviceLabel: row.device_label,
      issuedAt: toDate(row.issued_at),
      expiresAt: toDate(row.expires_at),
      rotatedAt: toNullableDate(row.rotated_at),
      revokedAt: toNullableDate(row.revoked_at),
      reuseDetectedAt: toNullableDate(row.reuse_detected_at),
    };
  }
}
