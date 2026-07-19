import { UserStatus } from '@modules/identity';
import { RbacRole, Role } from '@shared/enums';
import type { QueryRunner } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_SEED_DEFINITION, SEED_ADMIN_KEY } from './seed.constants';
import type { SeedAdminRuntimeConfig } from './seed.types';
import { createSeedAdminSeeder, seedAdmin } from './seed-admin';
import { computeSeedChecksum } from './seed-checksum';

const CONFIG: SeedAdminRuntimeConfig = {
  email: 'admin@example.test',
  password: 'runtime-only-password',
  displayName: 'Local Administrator',
};

const HASH = '$2b$12$runtime-only-hash';
const USER_ID = 'user-1';
const ROLE_ID = 'role-1';
const INPUT = {
  email: CONFIG.email,
  displayName: CONFIG.displayName,
  passwordHash: HASH,
};

interface HarnessOptions {
  readonly existingUserId?: string;
  readonly roleExists?: boolean;
  readonly assignmentExists?: boolean;
  readonly insertReturnsEmpty?: boolean;
}

function buildQueryRunner(options: HarnessOptions = {}) {
  const query = vi.fn((sql: string) => {
    if (sql.includes('FROM "users"')) {
      return Promise.resolve(
        options.existingUserId === undefined
          ? []
          : [{ id: options.existingUserId }],
      );
    }
    if (sql.includes('INSERT INTO "users"')) {
      return Promise.resolve(
        options.insertReturnsEmpty === true ? [] : [{ id: USER_ID }],
      );
    }
    if (sql.includes('FROM "roles"')) {
      return Promise.resolve(
        options.roleExists === false ? [] : [{ id: ROLE_ID }],
      );
    }
    if (sql.includes('FROM "user_role_assignments"')) {
      return Promise.resolve(
        options.assignmentExists === true ? [{ id: 'a1' }] : [],
      );
    }
    return Promise.resolve([]);
  });
  return { query } as unknown as QueryRunner & { query: typeof query };
}

describe('seedAdmin', () => {
  it('creates a new active administrator, credential, and global assignment', async () => {
    const queryRunner = buildQueryRunner();

    await expect(seedAdmin(queryRunner, INPUT)).resolves.toEqual({
      userId: USER_ID,
      created: true,
    });

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "users"'),
      [CONFIG.email, Role.Admin, UserStatus.Active, CONFIG.displayName],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "password_credentials"'),
      [USER_ID, HASH],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM "roles"'),
      [RbacRole.TeamAdmin],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "user_role_assignments"'),
      [USER_ID, ROLE_ID],
    );
  });

  it('reactivates an existing account without duplicating its assignment', async () => {
    const queryRunner = buildQueryRunner({
      existingUserId: USER_ID,
      assignmentExists: true,
    });

    await expect(seedAdmin(queryRunner, INPUT)).resolves.toEqual({
      userId: USER_ID,
      created: false,
    });

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "users"'),
      [USER_ID, Role.Admin, UserStatus.Active, CONFIG.displayName],
    );
    expect(queryRunner.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "users"'),
      expect.anything(),
    );
    expect(queryRunner.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "user_role_assignments"'),
      expect.anything(),
    );
  });

  it('throws when the RBAC migration has not seeded the TEAM_ADMIN role', async () => {
    const queryRunner = buildQueryRunner({ roleExists: false });

    await expect(seedAdmin(queryRunner, INPUT)).rejects.toThrow(
      'Role "TEAM_ADMIN" is missing. Run "npm run migration:run" before seeding.',
    );
  });

  it('throws when the administrator insert returns no id', async () => {
    const queryRunner = buildQueryRunner({ insertReturnsEmpty: true });

    await expect(seedAdmin(queryRunner, INPUT)).rejects.toThrow(
      'Administrator insert did not return an id',
    );
  });
});

describe('createSeedAdminSeeder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the admin key and a definition-derived checksum', () => {
    const passwordHash = { hash: vi.fn().mockResolvedValue(HASH) };

    const seeder = createSeedAdminSeeder(passwordHash, () => CONFIG);

    expect(seeder.key).toBe(SEED_ADMIN_KEY);
    expect(seeder.checksum).toBe(computeSeedChecksum(ADMIN_SEED_DEFINITION));
  });

  it('hashes the runtime password and provisions the admin through the scope', async () => {
    const passwordHash = { hash: vi.fn().mockResolvedValue(HASH) };
    const queryRunner = buildQueryRunner();
    const seeder = createSeedAdminSeeder(passwordHash, () => CONFIG);

    await seeder.run({ queryRunner });

    expect(passwordHash.hash).toHaveBeenCalledWith(CONFIG.password);
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "password_credentials"'),
      [USER_ID, HASH],
    );
  });

  it('resolves the runtime credential lazily, only when run', () => {
    const passwordHash = { hash: vi.fn().mockResolvedValue(HASH) };
    const loadConfig = vi.fn(() => CONFIG);

    createSeedAdminSeeder(passwordHash, loadConfig);

    expect(loadConfig).not.toHaveBeenCalled();
  });
});
