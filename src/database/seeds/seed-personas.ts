import type { UserStatus } from '@modules/identity';
import { UserStatus as IdentityUserStatus } from '@modules/identity';
import type { QueryRunner } from 'typeorm';

import { PERSONAS_SEED_DEFINITION, SEED_PERSONAS_KEY } from './seed.constants';
import type {
  Seeder,
  SeedPasswordHashPort,
  SeedPersonasRuntimeConfig,
  SeedScope,
} from './seed.types';
import { computeSeedChecksum } from './seed-checksum';
import {
  CATALOG_DEFINITIONS,
  PERSONA_DEFINITIONS,
  PERSONA_MEMBERSHIP_INSERT_FAILED_MESSAGE,
  PERSONA_MEMBERSHIP_STATUS,
  PERSONA_ROLE_MISSING_PREFIX,
  PERSONA_TEAM_MISSING_MESSAGE,
  PERSONA_USER_INSERT_FAILED_MESSAGE,
  VENUE_DEFINITIONS,
} from './seed-personas.constants';
import type {
  IdRow,
  PersonaDefinition,
  SeedPersonasResult,
} from './seed-personas.types';
import { PersonaScope } from './seed-personas.types';
import { TEAM_SLUG } from './seed-team.constants';

const ACTIVE_USER_STATUS: UserStatus = IdentityUserStatus.Active;

/**
 * Build the demonstration-persona seeder for the once-only seed framework. The
 * shared credential is resolved lazily, so it is required only on the first-time
 * fresh database where the seeder actually runs. The checksum fingerprints the
 * seeder DEFINITION only, never the runtime password — rotating the credential
 * is not a definition change. Registered AFTER the team seeder: every persona is
 * linked to the team that seeder provisions.
 */
export function createSeedPersonasSeeder(
  passwordHash: SeedPasswordHashPort,
  loadConfig: () => SeedPersonasRuntimeConfig,
): Seeder {
  return {
    key: SEED_PERSONAS_KEY,
    checksum: computeSeedChecksum(PERSONAS_SEED_DEFINITION),
    run: (scope: SeedScope): Promise<void> =>
      runPersonaSeed(scope, passwordHash, loadConfig()),
  };
}

async function runPersonaSeed(
  scope: SeedScope,
  passwordHash: SeedPasswordHashPort,
  config: SeedPersonasRuntimeConfig,
): Promise<void> {
  const hashed = await passwordHash.hash(config.password);
  await seedPersonas(scope.queryRunner, hashed);
}

/**
 * Provision the full persona cast inside the caller-owned transaction scope:
 * every account with its credential, its active membership in team "un", and its
 * correctly scoped RBAC assignment (platform-wide for the super admin, team-
 * scoped for everyone else), plus the reference catalog entries and venues that
 * keep dashboards and pickers from rendering empty.
 *
 * Every step is a find-then-write against the same natural key the owning
 * module's unique index uses, so the body is idempotent on its own — on top of
 * the framework, which runs it exactly once per database. Writes go through this
 * transaction's query runner so the seed and its `seed_history` row commit or
 * roll back together, and column choices mirror each module's own repository
 * writes so no invariant is bypassed.
 */
export async function seedPersonas(
  queryRunner: QueryRunner,
  passwordHash: string,
): Promise<SeedPersonasResult> {
  const teamId = await resolveTeamId(queryRunner);
  for (const persona of PERSONA_DEFINITIONS) {
    await seedPersona(queryRunner, teamId, persona, passwordHash);
  }
  const catalogEntries = await seedCatalogEntries(queryRunner, teamId);
  const venues = await seedVenues(queryRunner, teamId);
  await bumpPolicyVersion(queryRunner);

  return {
    personas: PERSONA_DEFINITIONS.length,
    catalogEntries,
    venues,
  };
}

async function seedPersona(
  queryRunner: QueryRunner,
  teamId: string,
  persona: PersonaDefinition,
  passwordHash: string,
): Promise<void> {
  const userId = await ensureUser(queryRunner, persona);
  await ensureCredential(queryRunner, userId, passwordHash);
  const membershipId = await ensureMembership(queryRunner, teamId, userId);
  await ensureProfile(queryRunner, teamId, membershipId, userId, persona);
  const roleId = await resolveRoleId(queryRunner, persona.roleKey);
  await ensureAssignment(
    queryRunner,
    userId,
    roleId,
    scopeTeam(persona, teamId),
  );
}

/** The super admin's assignment is global (team_id IS NULL); everyone else's is team-scoped. */
function scopeTeam(persona: PersonaDefinition, teamId: string): string | null {
  return persona.scope === PersonaScope.Platform ? null : teamId;
}

async function resolveTeamId(queryRunner: QueryRunner): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "teams" WHERE lower("slug") = lower($1)`,
    [TEAM_SLUG],
  );
  return requireId(rows, PERSONA_TEAM_MISSING_MESSAGE);
}

async function ensureUser(
  queryRunner: QueryRunner,
  persona: PersonaDefinition,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "users"
      WHERE lower("email") = lower($1) AND "deleted_at" IS NULL`,
    [persona.email],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "users" ("email", "role", "status", "display_name")
     VALUES ($1, $2, $3, $4)
     RETURNING "id"`,
    [
      persona.email,
      persona.accountRole,
      ACTIVE_USER_STATUS,
      persona.displayName,
    ],
  );
  return requireId(rows, PERSONA_USER_INSERT_FAILED_MESSAGE);
}

async function ensureCredential(
  queryRunner: QueryRunner,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO "password_credentials" ("user_id", "password_hash")
     VALUES ($1, $2)
     ON CONFLICT ("user_id") DO NOTHING`,
    [userId, passwordHash],
  );
}

async function ensureMembership(
  queryRunner: QueryRunner,
  teamId: string,
  userId: string,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "memberships"
      WHERE "team_id" = $1 AND "user_id" = $2 AND "season_id" IS NULL
        AND "deleted_at" IS NULL
        AND "status" NOT IN ('archived', 'anonymized', 'left')`,
    [teamId, userId],
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
    [teamId, userId, PERSONA_MEMBERSHIP_STATUS],
  );
  const membershipId = requireId(
    rows,
    PERSONA_MEMBERSHIP_INSERT_FAILED_MESSAGE,
  );
  await queryRunner.query(
    `INSERT INTO "membership_status_events" ("membership_id", "from_status",
            "to_status", "actor_user_id", "effective_at")
     VALUES ($1, NULL, $2, $3, now())`,
    [membershipId, PERSONA_MEMBERSHIP_STATUS, userId],
  );
  return membershipId;
}

/**
 * Every persona membership gets a minimal player profile (name + email) so the
 * member directory, roles picker, and every profile-joining surface is
 * populated on a fresh database. Find-then-write on the 1:1 membership key,
 * mirroring the members module's own repository columns.
 */
async function ensureProfile(
  queryRunner: QueryRunner,
  teamId: string,
  membershipId: string,
  userId: string,
  persona: PersonaDefinition,
): Promise<void> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "member_profiles" WHERE "membership_id" = $1`,
    [membershipId],
  );
  if (existing.length > 0) {
    return;
  }
  await queryRunner.query(
    `INSERT INTO "member_profiles" ("membership_id", "team_id", "full_name",
            "email", "created_by")
     VALUES ($1, $2, $3, $4, $5)`,
    [membershipId, teamId, persona.displayName, persona.email, userId],
  );
}

async function resolveRoleId(
  queryRunner: QueryRunner,
  roleKey: string,
): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "roles" WHERE "key" = $1`,
    [roleKey],
  );
  return requireId(rows, `${PERSONA_ROLE_MISSING_PREFIX}${roleKey}`);
}

async function ensureAssignment(
  queryRunner: QueryRunner,
  userId: string,
  roleId: string,
  teamId: string | null,
): Promise<void> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "user_role_assignments"
      WHERE "user_id" = $1 AND "role_id" = $2
        AND "team_id" IS NOT DISTINCT FROM $3::uuid
        AND "season_id" IS NULL AND "revoked_at" IS NULL`,
    [userId, roleId, teamId],
  );
  if (rows.length > 0) {
    return;
  }
  await queryRunner.query(
    `INSERT INTO "user_role_assignments"
       ("user_id", "role_id", "team_id", "effective_from", "granted_by")
     VALUES ($1, $2, $3::uuid, now(), $1)`,
    [userId, roleId, teamId],
  );
}

async function seedCatalogEntries(
  queryRunner: QueryRunner,
  teamId: string,
): Promise<number> {
  for (const [catalog, key, label, sortOrder] of CATALOG_DEFINITIONS) {
    await queryRunner.query(
      `INSERT INTO "reference_catalog_entries"
         ("team_id", "catalog", "key", "label", "sort_order")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("team_id", "catalog", "key") DO NOTHING`,
      [teamId, catalog, key, label, sortOrder],
    );
  }
  return CATALOG_DEFINITIONS.length;
}

async function seedVenues(
  queryRunner: QueryRunner,
  teamId: string,
): Promise<number> {
  for (const venue of VENUE_DEFINITIONS) {
    const existing = await queryRows<IdRow>(
      queryRunner,
      `SELECT "id" FROM "venues"
        WHERE "team_id" = $1 AND lower("name") = lower($2)`,
      [teamId, venue.name],
    );
    if (existing.length === 0) {
      await queryRunner.query(
        `INSERT INTO "venues" ("team_id", "name", "address")
         VALUES ($1, $2, $3)`,
        [teamId, venue.name, venue.address],
      );
    }
  }
  return VENUE_DEFINITIONS.length;
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
