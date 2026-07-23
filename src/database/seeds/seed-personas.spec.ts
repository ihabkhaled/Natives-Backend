import { RbacRole, Role } from '@shared/enums';
import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PERSONAS_SEED_DEFINITION, SEED_PERSONAS_KEY } from './seed.constants';
import { computeSeedChecksum } from './seed-checksum';
import { createSeedPersonasSeeder, seedPersonas } from './seed-personas';
import {
  DEMO_MATCH_COUNT,
  PERSONA_DEFINITIONS,
  PRACTICE_SESSION_DEFINITIONS,
  VENUE_DEFINITIONS,
} from './seed-personas.constants';
import { PersonaScope } from './seed-personas.types';

const TEAM_ID = 'team-1';
const SEASON_ID = 'season-1';
const USER_ID = 'user-1';
const MEMBERSHIP_ID = 'membership-1';
const ROLE_ID = 'role-1';
const PASSWORD_HASH = 'hashed';

// P3-B1 self check-in window bounds (check-in-window.policy in the practices
// module): the window opens 60 minutes before the session start and closes at
// the session end. The seeder cannot import them (they are module-internal),
// so the pin restates the two numbers.
const CHECK_IN_OPENS_BEFORE_START_MINUTES = 60;
const CHECK_IN_CLOSES_AFTER_END_MINUTES = 0;

const MEMBERSHIP_PERSONAS = PERSONA_DEFINITIONS.filter(
  persona => persona.teamMembership,
);

interface HarnessOptions {
  readonly teamMissing?: boolean;
  readonly seasonMissing?: boolean;
  readonly userExists?: boolean;
  readonly membershipExists?: boolean;
  readonly profileExists?: boolean;
  readonly assignmentExists?: boolean;
  readonly roleMissing?: boolean;
  readonly venueExists?: boolean;
  readonly sessionExists?: boolean;
  readonly demoExists?: boolean;
  readonly emptyInsert?: string;
}

function rowsFor(exists: boolean | undefined, id: string): { id: string }[] {
  return exists === true ? [{ id }] : [];
}

function venueRows(
  parameters: readonly unknown[],
  options: HarnessOptions,
  insertedVenueNames: ReadonlySet<string>,
): { id: string }[] {
  const name = typeof parameters[1] === 'string' ? parameters[1] : '';
  const known = options.venueExists === true || insertedVenueNames.has(name);
  return rowsFor(known, 'venue-1');
}

function selectRows(
  sql: string,
  parameters: readonly unknown[],
  options: HarnessOptions,
  insertedVenueNames: ReadonlySet<string>,
): { id: string }[] | null {
  const providers: readonly (readonly [string, () => { id: string }[]])[] = [
    ['teams', () => (options.teamMissing === true ? [] : [{ id: TEAM_ID }])],
    [
      'seasons',
      () => (options.seasonMissing === true ? [] : [{ id: SEASON_ID }]),
    ],
    ['users', () => rowsFor(options.userExists, USER_ID)],
    ['memberships', () => rowsFor(options.membershipExists, MEMBERSHIP_ID)],
    ['member_profiles', () => rowsFor(options.profileExists, 'profile-1')],
    ['roles', () => (options.roleMissing === true ? [] : [{ id: ROLE_ID }])],
    [
      'user_role_assignments',
      () => rowsFor(options.assignmentExists, 'assign-1'),
    ],
    ['venues', () => venueRows(parameters, options, insertedVenueNames)],
    ['practice_sessions', () => rowsFor(options.sessionExists, 'session-1')],
    ['opponents', () => rowsFor(options.demoExists, 'opponent-1')],
    ['competitions', () => rowsFor(options.demoExists, 'competition-1')],
    ['match_rulesets', () => rowsFor(options.demoExists, 'ruleset-1')],
    ['fixtures', () => rowsFor(options.demoExists, 'fixture-1')],
    ['matches', () => rowsFor(options.demoExists, 'match-1')],
  ];
  for (const [table, provider] of providers) {
    if (sql.includes(`FROM "${table}"`)) {
      return provider();
    }
  }
  return null;
}

function insertedRows(
  sql: string,
  options: HarnessOptions,
): { id: string }[] | null {
  const returning: readonly (readonly [string, string])[] = [
    ['users', USER_ID],
    ['memberships', MEMBERSHIP_ID],
    ['practice_sessions', 'session-1'],
    ['opponents', 'opponent-1'],
    ['competitions', 'competition-1'],
    ['match_rulesets', 'ruleset-1'],
    ['fixtures', 'fixture-1'],
  ];
  for (const [table, id] of returning) {
    if (sql.includes(`INSERT INTO "${table}"`)) {
      return options.emptyInsert === table ? [] : [{ id }];
    }
  }
  return null;
}

function buildQueryRunner(options: HarnessOptions = {}) {
  const insertedVenueNames = new Set<string>();
  const query = vi.fn((sql: string, parameters: readonly unknown[] = []) => {
    if (sql.includes('INSERT INTO "venues"')) {
      const name = typeof parameters[1] === 'string' ? parameters[1] : '';
      insertedVenueNames.add(name);
    }
    return Promise.resolve(
      insertedRows(sql, options) ??
        selectRows(sql, parameters, options, insertedVenueNames) ??
        [],
    );
  });
  return { query } as unknown as QueryRunner & { query: typeof query };
}

function sqlOf(call: readonly unknown[]): string {
  const [sql] = call;
  return typeof sql === 'string' ? sql : '';
}

function statements(
  queryRunner: ReturnType<typeof buildQueryRunner>,
): readonly string[] {
  return queryRunner.query.mock.calls.map(call => sqlOf(call));
}

describe('createSeedPersonasSeeder', () => {
  it('carries the stable key and a definition-derived checksum', () => {
    const loadConfig = vi.fn(() => ({ password: 'persona-password' }));

    const seeder = createSeedPersonasSeeder(
      { hash: vi.fn().mockResolvedValue(PASSWORD_HASH) },
      loadConfig,
    );

    expect(seeder.key).toBe(SEED_PERSONAS_KEY);
    expect(seeder.checksum).toBe(computeSeedChecksum(PERSONAS_SEED_DEFINITION));
    expect(loadConfig).not.toHaveBeenCalled();
  });

  it('resolves and hashes the runtime credential only when it runs', async () => {
    const passwordHash = { hash: vi.fn().mockResolvedValue(PASSWORD_HASH) };
    const loadConfig = vi.fn(() => ({ password: 'persona-password' }));
    const queryRunner = buildQueryRunner();

    await createSeedPersonasSeeder(passwordHash, loadConfig).run({
      queryRunner,
    });

    expect(loadConfig).toHaveBeenCalledOnce();
    expect(passwordHash.hash).toHaveBeenCalledWith('persona-password');
  });
});

describe('seedPersonas', () => {
  it('provisions every persona, catalog entry, venue, session and the match queue', async () => {
    const queryRunner = buildQueryRunner();

    const result = await seedPersonas(queryRunner, PASSWORD_HASH);

    expect(result.personas).toBe(PERSONA_DEFINITIONS.length);
    expect(result.venues).toBe(VENUE_DEFINITIONS.length);
    expect(result.catalogEntries).toBeGreaterThan(0);
    expect(result.practiceSessions).toBe(PRACTICE_SESSION_DEFINITIONS.length);
    expect(result.matches).toBe(DEMO_MATCH_COUNT);

    const sql = statements(queryRunner);
    expect(sql.filter(s => s.includes('INSERT INTO "users"'))).toHaveLength(
      PERSONA_DEFINITIONS.length,
    );
    expect(
      sql.filter(s => s.includes('INSERT INTO "memberships"')),
    ).toHaveLength(MEMBERSHIP_PERSONAS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "member_profiles"')),
    ).toHaveLength(MEMBERSHIP_PERSONAS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "user_role_assignments"')),
    ).toHaveLength(PERSONA_DEFINITIONS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "practice_sessions"')),
    ).toHaveLength(PRACTICE_SESSION_DEFINITIONS.length);
    expect(
      sql.filter(s =>
        s.includes('INSERT INTO "practice_session_status_events"'),
      ),
    ).toHaveLength(PRACTICE_SESSION_DEFINITIONS.length);
    expect(sql.some(s => s.includes('UPDATE "rbac_policy_version"'))).toBe(
      true,
    );
  });

  it('defines exactly one membership-less platform-only super admin', () => {
    const membershipless = PERSONA_DEFINITIONS.filter(
      persona => !persona.teamMembership,
    );

    expect(membershipless).toHaveLength(1);
    expect(membershipless[0]).toMatchObject({
      email: 'platformonly@ultimatenatives.local',
      accountRole: Role.Admin,
      roleKey: RbacRole.SuperAdmin,
      scope: PersonaScope.Platform,
    });
  });

  it('never writes a membership or profile for the platform-only persona', async () => {
    const queryRunner = buildQueryRunner();

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sql = statements(queryRunner);
    // One membership + one profile per membership-holding persona and not one
    // more: the platform-only super admin ends with zero membership rows.
    expect(
      sql.filter(s => s.includes('INSERT INTO "memberships"')),
    ).toHaveLength(MEMBERSHIP_PERSONAS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "membership_status_events"')),
    ).toHaveLength(MEMBERSHIP_PERSONAS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "member_profiles"')),
    ).toHaveLength(MEMBERSHIP_PERSONAS.length);
    // The platform-only persona still gets an account and a global assignment.
    expect(sql.filter(s => s.includes('INSERT INTO "users"'))).toHaveLength(
      PERSONA_DEFINITIONS.length,
    );
    expect(
      sql.filter(s => s.includes('INSERT INTO "user_role_assignments"')),
    ).toHaveLength(PERSONA_DEFINITIONS.length);
  });

  it('seeds every practice session relative to the database clock, stored UTC', async () => {
    const queryRunner = buildQueryRunner();

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sessionInserts = statements(queryRunner).filter(s =>
      s.includes('INSERT INTO "practice_sessions"'),
    );
    expect(sessionInserts).toHaveLength(PRACTICE_SESSION_DEFINITIONS.length);
    for (const insert of sessionInserts) {
      // Instants derive from now() + a definition-fixed minute offset; the
      // definition itself never carries an absolute instant.
      expect(insert).toContain('now() + make_interval');
    }
  });

  it('keeps the session set balanced: past, in-progress and upcoming', () => {
    const past = PRACTICE_SESSION_DEFINITIONS.filter(
      session => session.startOffsetMinutes + session.durationMinutes < 0,
    );
    const upcoming = PRACTICE_SESSION_DEFINITIONS.filter(
      session => session.startOffsetMinutes > 0,
    );
    const inProgress = PRACTICE_SESSION_DEFINITIONS.filter(
      session =>
        session.startOffsetMinutes < 0 &&
        session.startOffsetMinutes + session.durationMinutes > 0,
    );

    expect(past.length).toBeGreaterThanOrEqual(2);
    expect(upcoming.length).toBeGreaterThanOrEqual(2);
    expect(inProgress).toHaveLength(1);
    // At least one upcoming session carries a still-open RSVP cutoff.
    expect(
      upcoming.some(
        session =>
          session.rsvpCutoffOffsetMinutes !== null &&
          session.startOffsetMinutes + session.rsvpCutoffOffsetMinutes > 0,
      ),
    ).toBe(true);
  });

  it('opens the P3-B1 self check-in window on one session at the seed instant', () => {
    const windowOpenAtSeedTime = PRACTICE_SESSION_DEFINITIONS.filter(
      session => {
        const opensAtOffset =
          session.startOffsetMinutes - CHECK_IN_OPENS_BEFORE_START_MINUTES;
        const closesAtOffset =
          session.startOffsetMinutes +
          session.durationMinutes +
          CHECK_IN_CLOSES_AFTER_END_MINUTES;
        return opensAtOffset <= 0 && closesAtOffset >= 0;
      },
    );

    expect(windowOpenAtSeedTime.length).toBeGreaterThanOrEqual(1);
  });

  it('seeds the scorekeeper queue exactly once on a fresh database', async () => {
    const queryRunner = buildQueryRunner();

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sql = statements(queryRunner);
    for (const table of [
      'opponents',
      'competitions',
      'match_rulesets',
      'fixtures',
      'matches',
    ]) {
      expect(
        sql.filter(s => s.includes(`INSERT INTO "${table}"`)),
      ).toHaveLength(1);
    }
    const fixtureInsert = sql.find(s => s.includes('INSERT INTO "fixtures"'));
    expect(fixtureInsert).toContain('now() + make_interval');
  });

  it('writes each persona profile with the display name and email of its persona', async () => {
    const queryRunner = buildQueryRunner();

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const profileInserts = queryRunner.query.mock.calls.filter(call =>
      sqlOf(call).includes('INSERT INTO "member_profiles"'),
    );
    const firstPersona = PERSONA_DEFINITIONS[0];
    expect(firstPersona?.teamMembership).toBe(true);
    expect(profileInserts[0]?.[1]).toEqual([
      MEMBERSHIP_ID,
      TEAM_ID,
      firstPersona?.displayName,
      firstPersona?.email,
      USER_ID,
    ]);
  });

  it('assigns the super admins globally and everyone else to the team', async () => {
    const queryRunner = buildQueryRunner();

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const assignments = queryRunner.query.mock.calls.filter(call =>
      sqlOf(call).includes('INSERT INTO "user_role_assignments"'),
    );
    const scopes = assignments.map(call => (call[1] as unknown[])[2]);
    const platformCount = PERSONA_DEFINITIONS.filter(
      persona => persona.scope === PersonaScope.Platform,
    ).length;

    expect(scopes.filter(scope => scope === null)).toHaveLength(platformCount);
    expect(scopes.filter(scope => scope === TEAM_ID)).toHaveLength(
      PERSONA_DEFINITIONS.length - platformCount,
    );
  });

  it('gives the platform personas the admin account role and the SUPER_ADMIN bundle', () => {
    const platformPersonas = PERSONA_DEFINITIONS.filter(
      persona => persona.scope === PersonaScope.Platform,
    );

    expect(platformPersonas.length).toBeGreaterThanOrEqual(2);
    for (const persona of platformPersonas) {
      expect(persona.accountRole).toBe(Role.Admin);
      expect(persona.roleKey).toBe(RbacRole.SuperAdmin);
    }
    expect(
      PERSONA_DEFINITIONS.filter(
        persona => persona.scope === PersonaScope.Team,
      ).every(persona => persona.accountRole === Role.User),
    ).toBe(true);
  });

  it('writes nothing new when every row already exists', async () => {
    const queryRunner = buildQueryRunner({
      userExists: true,
      membershipExists: true,
      profileExists: true,
      assignmentExists: true,
      venueExists: true,
      sessionExists: true,
      demoExists: true,
    });

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sql = statements(queryRunner);
    for (const table of [
      'users',
      'memberships',
      'member_profiles',
      'user_role_assignments',
      'venues',
      'practice_sessions',
      'practice_session_status_events',
      'opponents',
      'competitions',
      'match_rulesets',
      'fixtures',
      'matches',
    ]) {
      expect(sql.some(s => s.includes(`INSERT INTO "${table}"`))).toBe(false);
    }
  });

  it('backfills a missing profile for an existing membership', async () => {
    const queryRunner = buildQueryRunner({
      userExists: true,
      membershipExists: true,
      assignmentExists: true,
      venueExists: true,
      sessionExists: true,
      demoExists: true,
    });

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sql = statements(queryRunner);
    expect(
      sql.filter(s => s.includes('INSERT INTO "member_profiles"')),
    ).toHaveLength(MEMBERSHIP_PERSONAS.length);
  });

  it('fails loudly when the team seeder has not run', async () => {
    await expect(
      seedPersonas(buildQueryRunner({ teamMissing: true }), PASSWORD_HASH),
    ).rejects.toThrow(/seeded team/u);
  });

  it('fails loudly when the current season is missing', async () => {
    await expect(
      seedPersonas(buildQueryRunner({ seasonMissing: true }), PASSWORD_HASH),
    ).rejects.toThrow(/current season/u);
  });

  it('fails loudly when an RBAC role is missing', async () => {
    await expect(
      seedPersonas(buildQueryRunner({ roleMissing: true }), PASSWORD_HASH),
    ).rejects.toThrow(/RBAC role is missing/u);
  });

  it('fails loudly when a user insert returns no id', async () => {
    await expect(
      seedPersonas(buildQueryRunner({ emptyInsert: 'users' }), PASSWORD_HASH),
    ).rejects.toThrow(/did not return an id/u);
  });

  it('fails loudly when a membership insert returns no id', async () => {
    await expect(
      seedPersonas(
        buildQueryRunner({ emptyInsert: 'memberships' }),
        PASSWORD_HASH,
      ),
    ).rejects.toThrow(/did not return an id/u);
  });

  it('fails loudly when a practice session insert returns no id', async () => {
    await expect(
      seedPersonas(
        buildQueryRunner({ emptyInsert: 'practice_sessions' }),
        PASSWORD_HASH,
      ),
    ).rejects.toThrow(/did not return an id/u);
  });
});
