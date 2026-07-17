import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  firstRow,
  parseRole,
  parseUserStatus,
  toDate,
  toNullableDate,
} from '../lib/identity.helpers';
import type { UserRow, UserWithCredentialRow } from '../model/identity.rows';
import type {
  NewUser,
  User,
  UserWithCredential,
} from '../model/identity.types';

/**
 * Persistence for the users aggregate. Data access only: parameterized SQL run
 * through the caller's transaction scope, mapping snake_case rows into the
 * vendor-free User domain type. No secret material is read or written here.
 */
@Injectable()
export class UserRepository {
  async findById(scope: TransactionScope, id: string): Promise<User | null> {
    const rows = await scope.run<UserRow>(
      `SELECT "id", "email", "role", "status", "display_name", "created_at",
              "updated_at", "deleted_at", "version"
         FROM "users"
        WHERE "id" = $1 AND "deleted_at" IS NULL`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : this.toUser(row);
  }

  async findActiveByEmail(
    scope: TransactionScope,
    normalizedEmail: string,
  ): Promise<User | null> {
    const rows = await scope.run<UserRow>(
      `SELECT "id", "email", "role", "status", "display_name", "created_at",
              "updated_at", "deleted_at", "version"
         FROM "users"
        WHERE lower("email") = $1 AND "deleted_at" IS NULL`,
      [normalizedEmail],
    );
    const row = rows[0];
    return row === undefined ? null : this.toUser(row);
  }

  async findWithCredentialByEmail(
    scope: TransactionScope,
    normalizedEmail: string,
  ): Promise<UserWithCredential | null> {
    const rows = await scope.run<UserWithCredentialRow>(
      `SELECT u."id", u."email", u."role", u."status", u."display_name",
              u."created_at", u."updated_at", u."deleted_at", u."version",
              c."password_hash"
         FROM "users" u
         LEFT JOIN "password_credentials" c ON c."user_id" = u."id"
        WHERE lower(u."email") = $1 AND u."deleted_at" IS NULL`,
      [normalizedEmail],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { user: this.toUser(row), passwordHash: row.password_hash };
  }

  async insert(scope: TransactionScope, user: NewUser): Promise<User> {
    const rows = await scope.run<UserRow>(
      `INSERT INTO "users" ("id", "email", "role", "status", "display_name",
                            "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING "id", "email", "role", "status", "display_name", "created_at",
                 "updated_at", "deleted_at", "version"`,
      [
        user.id,
        user.email,
        user.role,
        user.status,
        user.displayName,
        user.now.toISOString(),
      ],
    );
    return this.toUser(firstRow(rows));
  }

  private toUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      role: parseRole(row.role),
      status: parseUserStatus(row.status),
      displayName: row.display_name,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      deletedAt: toNullableDate(row.deleted_at),
      version: row.version,
    };
  }
}
