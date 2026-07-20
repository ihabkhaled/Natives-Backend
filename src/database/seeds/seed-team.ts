import type { QueryRunner } from 'typeorm';

import { SEED_TEAM_KEY, TEAM_SEED_DEFINITION } from './seed.constants';
import type { Seeder, SeedScope } from './seed.types';
import { computeSeedChecksum } from './seed-checksum';
import {
  ADMIN_USER_MISSING_MESSAGE,
  MEMBERSHIP_INSERT_FAILED_MESSAGE,
  MEMBERSHIP_STATUS,
  SEASON_INSERT_FAILED_MESSAGE,
  SEASON_NAME_PREFIX,
  SEASON_STATUS,
  TEAM_ADMIN_ROLE_KEY,
  TEAM_ADMIN_ROLE_MISSING_MESSAGE,
  TEAM_INSERT_FAILED_MESSAGE,
  TEAM_NAME,
  TEAM_PRIMARY_COLOR,
  TEAM_SLUG,
} from './seed-team.constants';
import type { IdRow, SeedTeamResult } from './seed-team.types';

/**
 * Build the Ultimate Natives team seeder for the once-only seed framework. The
 * administrator it links is resolved lazily by email, so the runtime value is
 * read only on the first-time fresh database where the seeder actually runs. The
 * checksum fingerprints the seeder DEFINITION only, so neither the administrator
 * email nor the calendar year the season is derived from looks like a definition
 * change. This seeder is ordered AFTER the admin seeder in the registry: it
 * links the account that seeder provisions.
 */
export function createSeedTeamSeeder(loadAdminEmail: () => string): Seeder {
  return {
    key: SEED_TEAM_KEY,
    checksum: computeSeedChecksum(TEAM_SEED_DEFINITION),
    run: (scope: SeedScope): Promise<void> =>
      runTeamSeed(scope, loadAdminEmail()),
  };
}

async function runTeamSeed(
  scope: SeedScope,
  adminEmail: string,
): Promise<void> {
  await seedTeam(scope.queryRunner, adminEmail);
}

/**
 * Provision the real team inside the caller-owned transaction scope: the team
 * itself, the season covering the year it is first seeded, the administrator's
 * active membership (with its opening lifecycle event), and a team-scoped
 * TEAM_ADMIN role assignment, followed by the RBAC policy-version bump every
 * assignment write owes resolver caches.
 *
 * Every step is a find-then-write against the same natural key the owning
 * module's unique index uses, so the body is idempotent on its own — on top of
 * the framework, which runs it exactly once per database. Writes go through this
 * transaction's query runner rather than the modules' use cases: the framework
 * hands seeders a query runner precisely so the seed and its `seed_history` row
 * commit or roll back together, which a use case opening its own transaction
 * could not do. Column choices mirror each module's own repository writes, so no
 * invariant (slug form, canonical colour, status enum, actor columns, lifecycle
 * history) is bypassed. Only `security_events` is intentionally not written: a
 * system seed is not a principal's security-relevant action, and `seed_history`
 * is its ledger.
 */
export async function seedTeam(
  queryRunner: QueryRunner,
  adminEmail: string,
): Promise<SeedTeamResult> {
  const adminUserId = await resolveAdminUserId(queryRunner, adminEmail);
  const teamId = await ensureTeam(queryRunner, adminUserId);
  const seasonId = await ensureCurrentSeason(queryRunner, teamId, adminUserId);
  const membershipId = await ensureAdminMembership(
    queryRunner,
    teamId,
    adminUserId,
  );
  const roleId = await resolveTeamAdminRoleId(queryRunner);
  await ensureTeamRoleAssignment(queryRunner, adminUserId, roleId, teamId);
  await bumpPolicyVersion(queryRunner);

  return { teamId, seasonId, membershipId };
}

async function resolveAdminUserId(
  queryRunner: QueryRunner,
  email: string,
): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "users"
      WHERE lower("email") = lower($1) AND "deleted_at" IS NULL`,
    [email],
  );
  return requireId(rows, ADMIN_USER_MISSING_MESSAGE);
}

async function ensureTeam(
  queryRunner: QueryRunner,
  adminUserId: string,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "teams" WHERE lower("slug") = lower($1)`,
    [TEAM_SLUG],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "teams" ("slug", "name", "primary_color", "created_by")
     VALUES ($1, $2, $3, $4)
     RETURNING "id"`,
    [TEAM_SLUG, TEAM_NAME, TEAM_PRIMARY_COLOR, adminUserId],
  );
  return requireId(rows, TEAM_INSERT_FAILED_MESSAGE);
}

async function ensureCurrentSeason(
  queryRunner: QueryRunner,
  teamId: string,
  adminUserId: string,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "seasons"
      WHERE "team_id" = $1 AND lower("slug") = to_char(now(), 'YYYY')`,
    [teamId],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "seasons" ("team_id", "slug", "name", "starts_on", "ends_on",
            "status", "created_by")
     VALUES ($1, to_char(now(), 'YYYY'), $2 || to_char(now(), 'YYYY'),
            date_trunc('year', now())::date,
            (date_trunc('year', now()) + interval '1 year'
              - interval '1 day')::date,
            $3, $4)
     RETURNING "id"`,
    [teamId, SEASON_NAME_PREFIX, SEASON_STATUS, adminUserId],
  );
  return requireId(rows, SEASON_INSERT_FAILED_MESSAGE);
}

async function ensureAdminMembership(
  queryRunner: QueryRunner,
  teamId: string,
  adminUserId: string,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "memberships"
      WHERE "team_id" = $1 AND "user_id" = $2 AND "season_id" IS NULL
        AND "deleted_at" IS NULL
        AND "status" NOT IN ('archived', 'anonymized', 'left')`,
    [teamId, adminUserId],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "memberships" ("team_id", "user_id", "status",
            "status_effective_at", "joined_at", "created_by")
     VALUES ($1, $2, $3, now(), now(), $2)
     RETURNING "id"`,
    [teamId, adminUserId, MEMBERSHIP_STATUS],
  );
  const membershipId = requireId(rows, MEMBERSHIP_INSERT_FAILED_MESSAGE);
  await appendStatusEvent(queryRunner, membershipId, adminUserId);
  return membershipId;
}

async function appendStatusEvent(
  queryRunner: QueryRunner,
  membershipId: string,
  adminUserId: string,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO "membership_status_events" ("membership_id", "from_status",
            "to_status", "actor_user_id", "effective_at")
     VALUES ($1, NULL, $2, $3, now())`,
    [membershipId, MEMBERSHIP_STATUS, adminUserId],
  );
}

async function resolveTeamAdminRoleId(
  queryRunner: QueryRunner,
): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "roles" WHERE "key" = $1`,
    [TEAM_ADMIN_ROLE_KEY],
  );
  return requireId(rows, TEAM_ADMIN_ROLE_MISSING_MESSAGE);
}

async function ensureTeamRoleAssignment(
  queryRunner: QueryRunner,
  userId: string,
  roleId: string,
  teamId: string,
): Promise<void> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "user_role_assignments"
      WHERE "user_id" = $1 AND "role_id" = $2 AND "team_id" = $3
        AND "season_id" IS NULL AND "revoked_at" IS NULL`,
    [userId, roleId, teamId],
  );
  if (rows.length > 0) {
    return;
  }
  await queryRunner.query(
    `INSERT INTO "user_role_assignments"
       ("user_id", "role_id", "team_id", "effective_from", "granted_by")
     VALUES ($1, $2, $3, now(), $1)`,
    [userId, roleId, teamId],
  );
}

async function bumpPolicyVersion(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `UPDATE "rbac_policy_version"
        SET "version" = "version" + 1, "updated_at" = now()
      WHERE "singleton" = true`,
    [],
  );
}

function requireId(rows: readonly IdRow[], message: string): string {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(message);
  }
  return row.id;
}

async function queryRows<TRow>(
  queryRunner: QueryRunner,
  sql: string,
  parameters: readonly unknown[],
): Promise<readonly TRow[]> {
  return (await queryRunner.query(sql, [...parameters])) as TRow[];
}
