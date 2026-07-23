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
  DEMO_COMPETITION_NAME,
  DEMO_COMPETITION_STATUS,
  DEMO_COMPETITION_TYPE,
  DEMO_FIXTURE_HOME_AWAY,
  DEMO_FIXTURE_OFFSET_MINUTES,
  DEMO_FIXTURE_VENUE_NAME,
  DEMO_MATCH_COUNT,
  DEMO_OPPONENT_NAME,
  DEMO_OPPONENT_SHORT_NAME,
  DEMO_PROGRAM_ACTOR_EMAIL,
  DEMO_RULESET_GAME_TO,
  DEMO_RULESET_HALFTIME_AT,
  DEMO_RULESET_KEY,
  DEMO_RULESET_NAME,
  DEMO_RULESET_PERIODS,
  DEMO_RULESET_TIMEOUTS_PER_TEAM,
  DEMO_RULESET_WIN_BY,
  PERSONA_ACTOR_MISSING_PREFIX,
  PERSONA_DEFINITIONS,
  PERSONA_DEMO_INSERT_FAILED_PREFIX,
  PERSONA_MEMBERSHIP_INSERT_FAILED_MESSAGE,
  PERSONA_MEMBERSHIP_STATUS,
  PERSONA_ROLE_MISSING_PREFIX,
  PERSONA_SEASON_MISSING_MESSAGE,
  PERSONA_SESSION_INSERT_FAILED_MESSAGE,
  PERSONA_TEAM_MISSING_MESSAGE,
  PERSONA_USER_INSERT_FAILED_MESSAGE,
  PERSONA_VENUE_MISSING_PREFIX,
  PRACTICE_ORGANIZER_EMAIL,
  PRACTICE_SESSION_DEFINITIONS,
  PRACTICE_SESSION_STATUS,
  PRACTICE_SESSION_VISIBILITY,
  VENUE_DEFINITIONS,
} from './seed-personas.constants';
import type {
  DemoSeedScope,
  IdRow,
  PersonaDefinition,
  PracticeSessionDefinition,
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
 * every account with its credential, its active membership in team "un" (the
 * platform-only super admin deliberately gets NONE, so the "platform role alone
 * must not fabricate team membership" invariant is demonstrable), and its
 * correctly scoped RBAC assignment, plus the reference catalog entries, venues,
 * the relative-time practice program, and the scorekeeper's match queue that
 * keep every journey exercisable on a fresh database.
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
  const userIdsByEmail = new Map<string, string>();
  for (const persona of PERSONA_DEFINITIONS) {
    const userId = await seedPersona(
      queryRunner,
      teamId,
      persona,
      passwordHash,
    );
    userIdsByEmail.set(persona.email, userId);
  }
  const catalogEntries = await seedCatalogEntries(queryRunner, teamId);
  const venues = await seedVenues(queryRunner, teamId);
  const seasonId = await resolveSeasonId(queryRunner, teamId);
  const practiceSessions = await seedPracticeSessions(queryRunner, {
    teamId,
    seasonId,
    actorUserId: requireActorId(userIdsByEmail, PRACTICE_ORGANIZER_EMAIL),
  });
  const matches = await seedMatchProgram(queryRunner, {
    teamId,
    seasonId,
    actorUserId: requireActorId(userIdsByEmail, DEMO_PROGRAM_ACTOR_EMAIL),
  });
  await bumpPolicyVersion(queryRunner);

  return {
    personas: PERSONA_DEFINITIONS.length,
    catalogEntries,
    venues,
    practiceSessions,
    matches,
  };
}

async function seedPersona(
  queryRunner: QueryRunner,
  teamId: string,
  persona: PersonaDefinition,
  passwordHash: string,
): Promise<string> {
  const userId = await ensureUser(queryRunner, persona);
  await ensureCredential(queryRunner, userId, passwordHash);
  if (persona.teamMembership) {
    const membershipId = await ensureMembership(queryRunner, teamId, userId);
    await ensureProfile(queryRunner, teamId, membershipId, userId, persona);
  }
  const roleId = await resolveRoleId(queryRunner, persona.roleKey);
  await ensureAssignment(
    queryRunner,
    userId,
    roleId,
    scopeTeam(persona, teamId),
  );
  return userId;
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

/** The current season the team seeder provisioned (slug = the seed year). */
async function resolveSeasonId(
  queryRunner: QueryRunner,
  teamId: string,
): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "seasons"
      WHERE "team_id" = $1 AND lower("slug") = to_char(now(), 'YYYY')`,
    [teamId],
  );
  return requireId(rows, PERSONA_SEASON_MISSING_MESSAGE);
}

function requireActorId(
  userIdsByEmail: ReadonlyMap<string, string>,
  email: string,
): string {
  const userId = userIdsByEmail.get(email);
  if (userId === undefined) {
    throw new Error(`${PERSONA_ACTOR_MISSING_PREFIX}${email}`);
  }
  return userId;
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

async function resolveVenueId(
  queryRunner: QueryRunner,
  teamId: string,
  name: string,
): Promise<string> {
  const rows = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "venues"
      WHERE "team_id" = $1 AND lower("name") = lower($2)`,
    [teamId, name],
  );
  return requireId(rows, `${PERSONA_VENUE_MISSING_PREFIX}${name}`);
}

/**
 * The demonstration practice program: published, venue-linked sessions whose
 * instants derive from the database clock AT SEED TIME (`now()` +
 * definition-fixed minute offsets, stored UTC as timestamptz), so a fresh stack
 * boots with past history, one in-progress session whose P3-B1 self check-in
 * window is open, and upcoming RSVP-able sessions. Each session appends its
 * opening status event, mirroring the practices module's create-then-publish
 * lifecycle history.
 */
async function seedPracticeSessions(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
): Promise<number> {
  for (const session of PRACTICE_SESSION_DEFINITIONS) {
    await seedPracticeSession(queryRunner, scope, session);
  }
  return PRACTICE_SESSION_DEFINITIONS.length;
}

async function seedPracticeSession(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
  session: PracticeSessionDefinition,
): Promise<void> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "practice_sessions"
      WHERE "team_id" = $1 AND "notes" = $2`,
    [scope.teamId, session.notes],
  );
  if (existing.length > 0) {
    return;
  }
  const venueId = await resolveVenueId(
    queryRunner,
    scope.teamId,
    session.venueName,
  );
  const sessionId = await insertPracticeSession(
    queryRunner,
    scope,
    session,
    venueId,
  );
  await queryRunner.query(
    `INSERT INTO "practice_session_status_events"
       ("session_id", "from_status", "to_status", "actor_user_id")
     VALUES ($1, NULL, $2, $3)`,
    [sessionId, PRACTICE_SESSION_STATUS, scope.actorUserId],
  );
}

async function insertPracticeSession(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
  session: PracticeSessionDefinition,
  venueId: string,
): Promise<string> {
  const endOffset = session.startOffsetMinutes + session.durationMinutes;
  const rsvpOffset =
    session.rsvpCutoffOffsetMinutes === null
      ? null
      : session.startOffsetMinutes + session.rsvpCutoffOffsetMinutes;
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "practice_sessions" ("team_id", "season_id", "session_type",
            "venue_id", "starts_at", "ends_at", "rsvp_cutoff_at", "visibility",
            "organizer_user_id", "notes", "status", "created_by")
     VALUES ($1, $2, $3, $4,
            now() + make_interval(mins => $5::int),
            now() + make_interval(mins => $6::int),
            CASE WHEN $7::int IS NULL THEN NULL
                 ELSE now() + make_interval(mins => $7::int) END,
            $8, $9, $10, $11, $9)
     RETURNING "id"`,
    [
      scope.teamId,
      scope.seasonId,
      session.sessionType,
      venueId,
      session.startOffsetMinutes,
      endOffset,
      rsvpOffset,
      PRACTICE_SESSION_VISIBILITY,
      scope.actorUserId,
      session.notes,
      PRACTICE_SESSION_STATUS,
    ],
  );
  return requireId(rows, PERSONA_SESSION_INSERT_FAILED_MESSAGE);
}

/**
 * The demonstration match program — the scorekeeper journey's queue: one
 * catalogued opponent, one published friendly competition in the current
 * season, one active ruleset version, one fixture scheduled tomorrow (relative
 * to the seed instant), and its single authoritative scheduled match. Natural
 * keys mirror each owning module's unique indexes (opponent name, competition
 * name per team+season, ruleset key's active version, one non-abandoned match
 * per fixture).
 */
async function seedMatchProgram(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
): Promise<number> {
  const opponentId = await ensureOpponent(queryRunner, scope);
  const competitionId = await ensureCompetition(queryRunner, scope);
  const rulesetId = await ensureRuleset(queryRunner, scope);
  const fixtureId = await ensureFixture(
    queryRunner,
    scope,
    competitionId,
    opponentId,
  );
  await ensureMatch(queryRunner, scope, competitionId, fixtureId, rulesetId);
  return DEMO_MATCH_COUNT;
}

async function ensureOpponent(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "opponents"
      WHERE "team_id" = $1 AND lower("name") = lower($2)
        AND "deleted_at" IS NULL`,
    [scope.teamId, DEMO_OPPONENT_NAME],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "opponents" ("team_id", "name", "short_name", "created_by")
     VALUES ($1, $2, $3, $4)
     RETURNING "id"`,
    [
      scope.teamId,
      DEMO_OPPONENT_NAME,
      DEMO_OPPONENT_SHORT_NAME,
      scope.actorUserId,
    ],
  );
  return requireId(rows, `${PERSONA_DEMO_INSERT_FAILED_PREFIX}opponent`);
}

async function ensureCompetition(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "competitions"
      WHERE "team_id" = $1 AND "season_id" = $2 AND lower("name") = lower($3)
        AND "deleted_at" IS NULL`,
    [scope.teamId, scope.seasonId, DEMO_COMPETITION_NAME],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "competitions" ("team_id", "season_id", "name",
            "competition_type", "status", "published_by", "published_at",
            "created_by")
     VALUES ($1, $2, $3, $4, $5, $6, now(), $6)
     RETURNING "id"`,
    [
      scope.teamId,
      scope.seasonId,
      DEMO_COMPETITION_NAME,
      DEMO_COMPETITION_TYPE,
      DEMO_COMPETITION_STATUS,
      scope.actorUserId,
    ],
  );
  return requireId(rows, `${PERSONA_DEMO_INSERT_FAILED_PREFIX}competition`);
}

async function ensureRuleset(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "match_rulesets"
      WHERE "team_id" = $1 AND "ruleset_key" = $2 AND "status" = 'active'`,
    [scope.teamId, DEMO_RULESET_KEY],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "match_rulesets" ("team_id", "ruleset_key", "name", "game_to",
            "win_by", "halftime_at", "timeouts_per_team", "periods",
            "created_by")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING "id"`,
    [
      scope.teamId,
      DEMO_RULESET_KEY,
      DEMO_RULESET_NAME,
      DEMO_RULESET_GAME_TO,
      DEMO_RULESET_WIN_BY,
      DEMO_RULESET_HALFTIME_AT,
      DEMO_RULESET_TIMEOUTS_PER_TEAM,
      DEMO_RULESET_PERIODS,
      scope.actorUserId,
    ],
  );
  return requireId(rows, `${PERSONA_DEMO_INSERT_FAILED_PREFIX}ruleset`);
}

async function ensureFixture(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
  competitionId: string,
  opponentId: string,
): Promise<string> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "fixtures"
      WHERE "competition_id" = $1 AND "opponent_id" = $2
        AND "deleted_at" IS NULL`,
    [competitionId, opponentId],
  );
  const found = existing[0];
  if (found !== undefined) {
    return found.id;
  }
  const venueId = await resolveVenueId(
    queryRunner,
    scope.teamId,
    DEMO_FIXTURE_VENUE_NAME,
  );
  const rows = await queryRows<IdRow>(
    queryRunner,
    `INSERT INTO "fixtures" ("competition_id", "team_id", "season_id",
            "opponent_id", "venue_id", "home_away", "scheduled_at",
            "created_by")
     VALUES ($1, $2, $3, $4, $5, $6,
            now() + make_interval(mins => $7::int), $8)
     RETURNING "id"`,
    [
      competitionId,
      scope.teamId,
      scope.seasonId,
      opponentId,
      venueId,
      DEMO_FIXTURE_HOME_AWAY,
      DEMO_FIXTURE_OFFSET_MINUTES,
      scope.actorUserId,
    ],
  );
  return requireId(rows, `${PERSONA_DEMO_INSERT_FAILED_PREFIX}fixture`);
}

async function ensureMatch(
  queryRunner: QueryRunner,
  scope: DemoSeedScope,
  competitionId: string,
  fixtureId: string,
  rulesetId: string,
): Promise<void> {
  const existing = await queryRows<IdRow>(
    queryRunner,
    `SELECT "id" FROM "matches"
      WHERE "fixture_id" = $1 AND "status" <> 'abandoned'`,
    [fixtureId],
  );
  if (existing.length > 0) {
    return;
  }
  await queryRunner.query(
    `INSERT INTO "matches" ("team_id", "season_id", "competition_id",
            "fixture_id", "ruleset_id", "home_away", "created_by")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      scope.teamId,
      scope.seasonId,
      competitionId,
      fixtureId,
      rulesetId,
      DEMO_FIXTURE_HOME_AWAY,
      scope.actorUserId,
    ],
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
