import { UserStatus } from '@modules/identity';
import { Role } from '@shared/enums';
import type { QueryRunner } from 'typeorm';

import { ADMIN_SEED_DEFINITION, SEED_ADMIN_KEY } from './seed.constants';
import type {
  SeedAdminRuntimeConfig,
  Seeder,
  SeedPasswordHashPort,
  SeedScope,
} from './seed.types';
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
import { computeSeedChecksum } from './seed-checksum';

/**
 * Build the default-administrator seeder for the once-only seed framework. The
 * runtime credential is resolved lazily via `loadConfig`, so it is required only
 * on the first-time fresh database where the seeder actually runs — a database
 * that has already recorded this seed never touches the credential again. The
 * checksum fingerprints the seeder DEFINITION only, so rotating the password
 * does not look like a definition change.
 */
export function createSeedAdminSeeder(
  passwordHash: SeedPasswordHashPort,
  loadConfig: () => SeedAdminRuntimeConfig,
): Seeder {
  return {
    key: SEED_ADMIN_KEY,
    checksum: computeSeedChecksum(ADMIN_SEED_DEFINITION),
    run: (scope: SeedScope): Promise<void> =>
      runAdminSeed(scope, passwordHash, loadConfig()),
  };
}

async function runAdminSeed(
  scope: SeedScope,
  passwordHash: SeedPasswordHashPort,
  config: SeedAdminRuntimeConfig,
): Promise<void> {
  const hashedPassword = await passwordHash.hash(config.password);
  await seedAdmin(scope.queryRunner, {
    email: config.email,
    displayName: config.displayName,
    passwordHash: hashedPassword,
  });
}

/**
 * Provision the administrator inside the caller-owned transaction scope. Creates
 * the account on a fresh database, or restores an existing one to active/admin
 * and rotates its stored credential, while preserving a single global TEAM_ADMIN
 * assignment. The framework runs this exactly once per database.
 */
export async function seedAdmin(
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
