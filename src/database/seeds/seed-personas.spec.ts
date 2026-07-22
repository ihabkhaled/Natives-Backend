import { RbacRole, Role } from '@shared/enums';
import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PERSONAS_SEED_DEFINITION, SEED_PERSONAS_KEY } from './seed.constants';
import { computeSeedChecksum } from './seed-checksum';
import { createSeedPersonasSeeder, seedPersonas } from './seed-personas';
import {
  PERSONA_DEFINITIONS,
  VENUE_DEFINITIONS,
} from './seed-personas.constants';
import { PersonaScope } from './seed-personas.types';

const TEAM_ID = 'team-1';
const USER_ID = 'user-1';
const MEMBERSHIP_ID = 'membership-1';
const ROLE_ID = 'role-1';
const PASSWORD_HASH = 'hashed';

interface HarnessOptions {
  readonly teamMissing?: boolean;
  readonly userExists?: boolean;
  readonly membershipExists?: boolean;
  readonly profileExists?: boolean;
  readonly assignmentExists?: boolean;
  readonly roleMissing?: boolean;
  readonly venueExists?: boolean;
  readonly emptyInsert?: string;
}

function rowsFor(exists: boolean | undefined, id: string): { id: string }[] {
  return exists === true ? [{ id }] : [];
}

function selectRows(
  sql: string,
  options: HarnessOptions,
): { id: string }[] | null {
  if (sql.includes('FROM "teams"')) {
    return options.teamMissing === true ? [] : [{ id: TEAM_ID }];
  }
  if (sql.includes('FROM "users"')) {
    return rowsFor(options.userExists, USER_ID);
  }
  if (sql.includes('FROM "memberships"')) {
    return rowsFor(options.membershipExists, MEMBERSHIP_ID);
  }
  if (sql.includes('FROM "member_profiles"')) {
    return rowsFor(options.profileExists, 'profile-1');
  }
  if (sql.includes('FROM "roles"')) {
    return options.roleMissing === true ? [] : [{ id: ROLE_ID }];
  }
  if (sql.includes('FROM "user_role_assignments"')) {
    return rowsFor(options.assignmentExists, 'assign-1');
  }
  if (sql.includes('FROM "venues"')) {
    return rowsFor(options.venueExists, 'venue-1');
  }
  return null;
}

function insertedRows(
  sql: string,
  options: HarnessOptions,
): { id: string }[] | null {
  if (sql.includes('INSERT INTO "users"')) {
    return options.emptyInsert === 'users' ? [] : [{ id: USER_ID }];
  }
  if (sql.includes('INSERT INTO "memberships"')) {
    return options.emptyInsert === 'memberships' ? [] : [{ id: MEMBERSHIP_ID }];
  }
  return null;
}

function buildQueryRunner(options: HarnessOptions = {}) {
  const query = vi.fn((sql: string) =>
    Promise.resolve(
      insertedRows(sql, options) ?? selectRows(sql, options) ?? [],
    ),
  );
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
  it('provisions every persona, catalog entry and venue on a fresh database', async () => {
    const queryRunner = buildQueryRunner();

    const result = await seedPersonas(queryRunner, PASSWORD_HASH);

    expect(result.personas).toBe(PERSONA_DEFINITIONS.length);
    expect(result.venues).toBe(VENUE_DEFINITIONS.length);
    expect(result.catalogEntries).toBeGreaterThan(0);

    const sql = statements(queryRunner);
    expect(sql.filter(s => s.includes('INSERT INTO "users"'))).toHaveLength(
      PERSONA_DEFINITIONS.length,
    );
    expect(
      sql.filter(s => s.includes('INSERT INTO "memberships"')),
    ).toHaveLength(PERSONA_DEFINITIONS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "member_profiles"')),
    ).toHaveLength(PERSONA_DEFINITIONS.length);
    expect(
      sql.filter(s => s.includes('INSERT INTO "user_role_assignments"')),
    ).toHaveLength(PERSONA_DEFINITIONS.length);
    expect(sql.some(s => s.includes('UPDATE "rbac_policy_version"'))).toBe(
      true,
    );
  });

  it('writes each persona profile with the display name and email of its persona', async () => {
    const queryRunner = buildQueryRunner();

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const profileInserts = queryRunner.query.mock.calls.filter(call =>
      sqlOf(call).includes('INSERT INTO "member_profiles"'),
    );
    const firstPersona = PERSONA_DEFINITIONS[0];
    expect(profileInserts[0]?.[1]).toEqual([
      MEMBERSHIP_ID,
      TEAM_ID,
      firstPersona?.displayName,
      firstPersona?.email,
      USER_ID,
    ]);
  });

  it('assigns the super admin globally and everyone else to the team', async () => {
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

  it('gives the super admin the admin account role and the SUPER_ADMIN bundle', () => {
    const superAdmin = PERSONA_DEFINITIONS.find(
      persona => persona.scope === PersonaScope.Platform,
    );

    expect(superAdmin?.accountRole).toBe(Role.Admin);
    expect(superAdmin?.roleKey).toBe(RbacRole.SuperAdmin);
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
    });

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sql = statements(queryRunner);
    expect(sql.some(s => s.includes('INSERT INTO "users"'))).toBe(false);
    expect(sql.some(s => s.includes('INSERT INTO "memberships"'))).toBe(false);
    expect(sql.some(s => s.includes('INSERT INTO "member_profiles"'))).toBe(
      false,
    );
    expect(
      sql.some(s => s.includes('INSERT INTO "user_role_assignments"')),
    ).toBe(false);
    expect(sql.some(s => s.includes('INSERT INTO "venues"'))).toBe(false);
  });

  it('backfills a missing profile for an existing membership', async () => {
    const queryRunner = buildQueryRunner({
      userExists: true,
      membershipExists: true,
      assignmentExists: true,
      venueExists: true,
    });

    await seedPersonas(queryRunner, PASSWORD_HASH);

    const sql = statements(queryRunner);
    expect(
      sql.filter(s => s.includes('INSERT INTO "member_profiles"')),
    ).toHaveLength(PERSONA_DEFINITIONS.length);
  });

  it('fails loudly when the team seeder has not run', async () => {
    await expect(
      seedPersonas(buildQueryRunner({ teamMissing: true }), PASSWORD_HASH),
    ).rejects.toThrow(/seeded team/u);
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
});
