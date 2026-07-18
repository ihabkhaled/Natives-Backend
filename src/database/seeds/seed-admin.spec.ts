import type { SeedAdminConfig } from '@config/config.types';
import type { PasswordHashPort } from '@modules/auth';
import { UserStatus } from '@modules/identity';
import { RbacRole, Role } from '@shared/enums';
import type { DataSource, QueryRunner } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runSeedAdmin } from './seed-admin';

const CONFIG: SeedAdminConfig = {
  email: 'admin@example.test',
  password: 'runtime-only-password',
  displayName: 'Local Administrator',
};

const HASH = '$2b$12$runtime-only-hash';
const USER_ID = 'user-1';
const ROLE_ID = 'role-1';

interface HarnessOptions {
  readonly existingUserId?: string;
  readonly roleExists?: boolean;
  readonly assignmentExists?: boolean;
}

function buildHarness(options: HarnessOptions = {}) {
  let transactionActive = false;
  const query = vi.fn((sql: string) => {
    if (sql.includes('FROM "users"')) {
      return Promise.resolve(
        options.existingUserId === undefined
          ? []
          : [{ id: options.existingUserId }],
      );
    }
    if (sql.includes('INSERT INTO "users"')) {
      return Promise.resolve([{ id: USER_ID }]);
    }
    if (sql.includes('FROM "roles"')) {
      return Promise.resolve(
        options.roleExists === false ? [] : [{ id: ROLE_ID }],
      );
    }
    if (sql.includes('FROM "user_role_assignments"')) {
      return Promise.resolve(
        options.assignmentExists === true ? [{ id: 'assignment-1' }] : [],
      );
    }
    return Promise.resolve([]);
  });
  const queryRunner = {
    get isTransactionActive() {
      return transactionActive;
    },
    connect: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn(() => {
      transactionActive = true;
      return Promise.resolve();
    }),
    commitTransaction: vi.fn(() => {
      transactionActive = false;
      return Promise.resolve();
    }),
    rollbackTransaction: vi.fn(() => {
      transactionActive = false;
      return Promise.resolve();
    }),
    release: vi.fn().mockResolvedValue(undefined),
    query,
  };
  const dataSource = {
    createQueryRunner: vi.fn().mockReturnValue(queryRunner),
  };
  const passwordHash = {
    hash: vi.fn().mockResolvedValue(HASH),
    matches: vi.fn(),
  };

  return {
    dataSource: dataSource as unknown as DataSource,
    passwordHash: passwordHash as PasswordHashPort,
    queryRunner: queryRunner as unknown as QueryRunner,
    query,
    connect: queryRunner.connect,
    start: queryRunner.startTransaction,
    commit: queryRunner.commitTransaction,
    rollback: queryRunner.rollbackTransaction,
    release: queryRunner.release,
  };
}

describe('runSeedAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new active administrator, credential, and global role assignment', async () => {
    const harness = buildHarness();

    await expect(
      runSeedAdmin(harness.dataSource, harness.passwordHash, CONFIG),
    ).resolves.toEqual({ userId: USER_ID, created: true });

    expect(harness.passwordHash.hash).toHaveBeenCalledWith(CONFIG.password);
    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "users"'),
      [CONFIG.email, Role.Admin, UserStatus.Active, CONFIG.displayName],
    );
    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "password_credentials"'),
      [USER_ID, HASH],
    );
    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM "roles"'),
      [RbacRole.TeamAdmin],
    );
    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "user_role_assignments"'),
      [USER_ID, ROLE_ID],
    );
    expect(harness.connect).toHaveBeenCalledOnce();
    expect(harness.start).toHaveBeenCalledOnce();
    expect(harness.commit).toHaveBeenCalledOnce();
    expect(harness.rollback).not.toHaveBeenCalled();
    expect(harness.release).toHaveBeenCalledOnce();
  });

  it('reactivates and refreshes an existing account without duplicating its assignment', async () => {
    const harness = buildHarness({
      existingUserId: USER_ID,
      assignmentExists: true,
    });

    await expect(
      runSeedAdmin(harness.dataSource, harness.passwordHash, CONFIG),
    ).resolves.toEqual({ userId: USER_ID, created: false });

    expect(harness.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "users"'),
      [USER_ID, Role.Admin, UserStatus.Active, CONFIG.displayName],
    );
    expect(harness.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "users"'),
      expect.anything(),
    );
    expect(harness.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "user_role_assignments"'),
      expect.anything(),
    );
  });

  it('rolls back and releases when the RBAC migration has not seeded the role', async () => {
    const harness = buildHarness({ roleExists: false });

    await expect(
      runSeedAdmin(harness.dataSource, harness.passwordHash, CONFIG),
    ).rejects.toThrow(
      'Role "TEAM_ADMIN" is missing. Run "npm run migration:run" before seeding.',
    );

    expect(harness.commit).not.toHaveBeenCalled();
    expect(harness.rollback).toHaveBeenCalledOnce();
    expect(harness.release).toHaveBeenCalledOnce();
  });

  it('does not attempt rollback before a transaction starts and still releases', async () => {
    const harness = buildHarness();
    harness.connect.mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      runSeedAdmin(harness.dataSource, harness.passwordHash, CONFIG),
    ).rejects.toThrow('connection refused');

    expect(harness.start).not.toHaveBeenCalled();
    expect(harness.rollback).not.toHaveBeenCalled();
    expect(harness.release).toHaveBeenCalledOnce();
  });
});
