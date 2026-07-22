import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  firstRow,
  parseInvitationStatus,
  parseRole,
  toDate,
  toNullableDate,
} from '../lib/identity.helpers';
import { InvitationStatus } from '../model/identity.enums';
import type {
  InvitationRow,
  PublicInvitationRow,
} from '../model/identity.rows';
import type {
  Invitation,
  NewInvitation,
  PublicInvitationRecord,
} from '../model/identity.types';

/**
 * Persistence for invitations. Stores the sha-256 token hash only; the plaintext
 * invite token is delivered out-of-band and never persisted. Lookups by token
 * hash lock the row (FOR UPDATE) so acceptance is atomic and single-use.
 */
@Injectable()
export class InvitationRepository {
  private readonly columns = `"id", "email", "invited_by", "role", "team_id",
    "team_role_key", "status", "expires_at", "accepted_at", "revoked_at",
    "created_at", "updated_at"`;

  async insert(
    scope: TransactionScope,
    invitation: NewInvitation,
  ): Promise<Invitation> {
    const rows = await scope.run<InvitationRow>(
      `INSERT INTO "invitations" ("id", "email", "token_hash", "invited_by",
                                  "role", "team_id", "team_role_key", "status",
                                  "expires_at", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING ${this.columns}`,
      [
        invitation.id,
        invitation.email,
        invitation.tokenHash,
        invitation.invitedBy,
        invitation.role,
        invitation.teamId,
        invitation.teamRoleKey,
        InvitationStatus.Pending,
        invitation.expiresAt.toISOString(),
        invitation.now.toISOString(),
      ],
    );
    return this.toInvitation(firstRow(rows));
  }

  async findById(
    scope: TransactionScope,
    id: string,
  ): Promise<Invitation | null> {
    const rows = await scope.run<InvitationRow>(
      `SELECT ${this.columns} FROM "invitations" WHERE "id" = $1`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : this.toInvitation(row);
  }

  async findByTokenHashForUpdate(
    scope: TransactionScope,
    tokenHash: string,
  ): Promise<Invitation | null> {
    const rows = await scope.run<InvitationRow>(
      `SELECT ${this.columns} FROM "invitations"
        WHERE "token_hash" = $1 FOR UPDATE`,
      [tokenHash],
    );
    const row = rows[0];
    return row === undefined ? null : this.toInvitation(row);
  }

  async findPublicByTokenHash(
    scope: TransactionScope,
    tokenHash: string,
  ): Promise<PublicInvitationRecord | null> {
    const rows = await scope.run<PublicInvitationRow>(
      `SELECT i."id", i."email", i."invited_by", i."role", i."team_id",
              i."team_role_key", i."status", i."expires_at", i."accepted_at",
              i."revoked_at", i."created_at", i."updated_at",
              u."display_name" AS "inviter_display_name",
              t."name" AS "team_name"
         FROM "invitations" i
         LEFT JOIN "users" u ON u."id" = i."invited_by"
         LEFT JOIN "teams" t ON t."id" = i."team_id"
        WHERE i."token_hash" = $1`,
      [tokenHash],
    );
    const row = rows[0];
    return row === undefined
      ? null
      : {
          ...this.toInvitation(row),
          inviterName: row.inviter_display_name,
          teamName: row.team_name,
        };
  }

  async findActivePendingByEmail(
    scope: TransactionScope,
    normalizedEmail: string,
  ): Promise<Invitation | null> {
    const rows = await scope.run<InvitationRow>(
      `SELECT ${this.columns} FROM "invitations"
        WHERE lower("email") = $1 AND "status" = $2`,
      [normalizedEmail, InvitationStatus.Pending],
    );
    const row = rows[0];
    return row === undefined ? null : this.toInvitation(row);
  }

  async markAccepted(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "invitations"
          SET "status" = $2, "accepted_at" = $3, "updated_at" = $3
        WHERE "id" = $1`,
      [id, InvitationStatus.Accepted, now.toISOString()],
    );
  }

  async markRevoked(
    scope: TransactionScope,
    id: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "invitations"
          SET "status" = $2, "revoked_at" = $3, "updated_at" = $3
        WHERE "id" = $1`,
      [id, InvitationStatus.Revoked, now.toISOString()],
    );
  }

  async rotateToken(
    scope: TransactionScope,
    id: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "invitations"
          SET "token_hash" = $2, "expires_at" = $3, "status" = $4,
              "updated_at" = $5
        WHERE "id" = $1`,
      [
        id,
        tokenHash,
        expiresAt.toISOString(),
        InvitationStatus.Pending,
        now.toISOString(),
      ],
    );
  }

  async expireOverdue(scope: TransactionScope, now: Date): Promise<number> {
    const rows = await scope.run<InvitationRow>(
      `UPDATE "invitations"
          SET "status" = $1, "updated_at" = $2
        WHERE "status" = $3 AND "expires_at" <= $2
        RETURNING ${this.columns}`,
      [InvitationStatus.Expired, now.toISOString(), InvitationStatus.Pending],
    );
    return rows.length;
  }

  private toInvitation(row: InvitationRow): Invitation {
    return {
      id: row.id,
      email: row.email,
      invitedBy: row.invited_by,
      role: parseRole(row.role),
      teamId: row.team_id,
      teamRoleKey: row.team_role_key,
      status: parseInvitationStatus(row.status),
      expiresAt: toDate(row.expires_at),
      acceptedAt: toNullableDate(row.accepted_at),
      revokedAt: toNullableDate(row.revoked_at),
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    };
  }
}
