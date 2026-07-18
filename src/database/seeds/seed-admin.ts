import type { SeedAdminConfig } from '@config/config.types';
import type { PasswordHashPort } from '@modules/auth';
import { UserStatus } from '@modules/identity';
import { Role } from '@shared/enums';
import type { DataSource, QueryRunner } from 'typeorm';

import {
  ADMIN_ROLE_KEY,
  ADMIN_ROLE_MISSING_MESSAGE,
  ADMIN_USER_INSERT_FAILED_MESSAGE,
} from './seed-admin.constants';
import type {
  IdRow,
  SeedAdminInput,
  SeedAdminResult,
} from './seed-admin.types';

/**
 * Hash the runtime-only password and provision the administrator atomically.
 * Reruns deliberately restore the account to active/admin and rotate the stored
 * credential while preserving a single global TEAM_ADMIN assignment.
 */
export async function runSeedAdmin(
  dataSource: DataSource,
  passwordHash: PasswordHashPort,
  config: SeedAdminConfig,
): Promise<SeedAdminResult> {
  const hashedPassword = await passwordHash.hash(config.password);
  return runInTransaction(dataSource, {
    email: config.email,
    displayName: config.displayName,
    passwordHash: hashedPassword,
  });
}

async function runInTransaction(
  dataSource: DataSource,
  input: SeedAdminInput,
): Promise<SeedAdminResult> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const result = await seedAdmin(queryRunner, input);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    throw error;
  } finally {
    await queryRunner.release();
  }
}

async function seedAdmin(
  queryRunner: QueryRunner,
  input: SeedAdminInput,
): Promise<SeedAdminResult> {
  const existingUserId = await findUserId(queryRunner, input.email);
  const created = existingUserId === null;
  const userId =
    existingUserId ??
    (await insertAdminUser(queryRunner, input.email, input.displayName));

  if (!created) {
    await updateAdminUser(queryRunner, userId, input.displayName);
  }
  await upsertPasswordCredential(queryRunner, userId, input.passwordHash);
  const roleId = await resolveRoleId(queryRunner);
  await ensureGlobalRoleAssignment(queryRunner, userId, roleId);

  return { userId, created };
}

async function findUserId(
  queryRunner: QueryRunner,
  email: string,
): Promise<string | null> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "users"
      WHERE lower("email") = lower($1) AND "deleted_at" IS NULL`,
    [email],
  );
  return rows[0]?.id ?? null;
}

async function insertAdminUser(
  queryRunner: QueryRunner,
  email: string,
  displayName: string,
): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "users" ("email", "role", "status", "display_name")
     VALUES ($1, $2, $3, $4)
     RETURNING "id"`,
    [email, Role.Admin, UserStatus.Active, displayName],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(ADMIN_USER_INSERT_FAILED_MESSAGE);
  }
  return row.id;
}

async function updateAdminUser(
  queryRunner: QueryRunner,
  userId: string,
  displayName: string,
): Promise<void> {
  await queryRunner.query(
    `UPDATE "users"
        SET "role" = $2, "status" = $3, "display_name" = $4,
            "updated_at" = now(), "version" = "version" + 1
      WHERE "id" = $1`,
    [userId, Role.Admin, UserStatus.Active, displayName],
  );
}

async function upsertPasswordCredential(
  queryRunner: QueryRunner,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO "password_credentials" ("user_id", "password_hash")
     VALUES ($1, $2)
     ON CONFLICT ("user_id") DO UPDATE
       SET "password_hash" = EXCLUDED."password_hash",
           "updated_at" = now(),
           "version" = "password_credentials"."version" + 1`,
    [userId, passwordHash],
  );
}

async function resolveRoleId(queryRunner: QueryRunner): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "roles" WHERE "key" = $1`,
    [ADMIN_ROLE_KEY],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(ADMIN_ROLE_MISSING_MESSAGE);
  }
  return row.id;
}

async function ensureGlobalRoleAssignment(
  queryRunner: QueryRunner,
  userId: string,
  roleId: string,
): Promise<void> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "user_role_assignments"
      WHERE "user_id" = $1 AND "role_id" = $2
        AND "team_id" IS NULL AND "season_id" IS NULL
        AND "revoked_at" IS NULL`,
    [userId, roleId],
  );
  if (rows.length > 0) {
    return;
  }
  await queryRunner.query(
    `INSERT INTO "user_role_assignments"
       ("user_id", "role_id", "effective_from")
     VALUES ($1, $2, now())`,
    [userId, roleId],
  );
}

async function queryRows<TRow>(
  queryRunner: QueryRunner,
  sql: string,
  parameters: readonly unknown[],
): Promise<readonly TRow[]> {
  return (await queryRunner.query(sql, [...parameters])) as TRow[];
}
