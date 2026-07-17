import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { AppLogger } from '@core/logger';
import { RbacPermissionResolverService } from '@modules/rbac/application/rbac-permission-resolver.service';
import { RbacRepository } from '@modules/rbac/infrastructure/rbac.repository';
import type { RbacRoleRecord } from '@modules/rbac/model/rbac.types';
import { NodeEnv, Permission, RbacRole, Role } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';

const TEST_DB_CONFIG = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

const NOW = new Date('2026-06-01T12:00:00.000Z');
const TEAM_A = randomUUID();
const TEAM_B = randomUUID();

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: [
      BaselineSchema1721200000000,
      IdentitySchema1721300000000,
      RbacSchema1721400000000,
    ],
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    return dataSource;
  } catch {
    return null;
  }
}

function buildResolver(dataSource: DataSource): {
  readonly resolver: RbacPermissionResolverService;
  readonly repository: RbacRepository;
  readonly unitOfWork: TypeormUnitOfWorkAdapter;
} {
  const unitOfWork = new TypeormUnitOfWorkAdapter(dataSource);
  const repository = new RbacRepository();
  const clock: ClockPort = { now: () => NOW, uptime: () => 0 };
  const noop = (): undefined => undefined;
  const logger = {
    setContext: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  } as unknown as AppLogger;
  const resolver = new RbacPermissionResolverService(
    clock,
    unitOfWork,
    repository,
    logger,
  );
  return { resolver, repository, unitOfWork };
}

async function seedUser(
  dataSource: DataSource,
  status: string,
): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, $4)`,
    [id, `user-${id}@example.test`, Role.User, status],
  );
  return id;
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'RBAC integration (PostgreSQL)'
  : `RBAC integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }

  afterAll(async () => {
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  async function assign(
    userId: string,
    role: RbacRoleRecord,
    teamId: string | null,
  ): Promise<void> {
    const { repository, unitOfWork } = buildResolver(activeDataSource);
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssignment(scope, {
        id: randomUUID(),
        userId,
        roleId: role.id,
        roleKey: role.key,
        teamId,
        seasonId: null,
        effectiveFrom: NOW,
        effectiveTo: null,
        grantedBy: null,
      });
      await repository.bumpPolicyVersion(scope, NOW);
    });
  }

  async function findRole(role: RbacRole): Promise<RbacRoleRecord> {
    const { repository, unitOfWork } = buildResolver(activeDataSource);
    const record = await unitOfWork.runInTransaction(scope =>
      repository.findRoleByKey(scope, role),
    );
    if (record === null) {
      throw new Error(`seeded role ${role} not found`);
    }
    return record;
  }

  it('migrates from empty and seeds the catalog and bundles, reversibly', async () => {
    await activeDataSource.runMigrations();

    const permissions = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "permissions"`,
    );
    const roles = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "roles"`,
    );
    const rolePermissions = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "role_permissions"`,
    );
    const policy = await activeDataSource.query(
      `SELECT "version" FROM "rbac_policy_version"`,
    );
    expect(permissions[0].count).toBe(88);
    expect(roles[0].count).toBe(5);
    expect(rolePermissions[0].count).toBeGreaterThan(0);
    expect(policy[0].version).toBe(1);

    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.permissions') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('resolves scoped permissions per team and denies cross-team', async () => {
    const userId = await seedUser(activeDataSource, 'active');
    const coach = await findRole(RbacRole.Coach);
    await assign(userId, coach, TEAM_A);

    const { resolver } = buildResolver(activeDataSource);
    const principal: AuthUserIdentity = {
      userId,
      email: 'coach@example.test',
      roles: [],
    };

    const inTeamA = await resolver.resolve(principal, { teamId: TEAM_A });
    const inTeamB = await resolver.resolve(principal, { teamId: TEAM_B });

    expect(inTeamA.has(Permission.PracticeManage)).toBe(true);
    expect(inTeamB.has(Permission.PracticeManage)).toBe(false);
  });

  it('invalidates a stale cache after an assignment change', async () => {
    const userId = await seedUser(activeDataSource, 'active');
    const coach = await findRole(RbacRole.Coach);
    const teamAdmin = await findRole(RbacRole.TeamAdmin);
    await assign(userId, coach, TEAM_A);

    const { resolver } = buildResolver(activeDataSource);
    const principal: AuthUserIdentity = {
      userId,
      email: 'coach@example.test',
      roles: [],
    };

    const before = await resolver.resolve(principal, { teamId: TEAM_A });
    expect(before.has(Permission.MemberRolesManage)).toBe(false);

    // A new assignment bumps the policy version, invalidating the cache.
    await assign(userId, teamAdmin, TEAM_A);

    const after = await resolver.resolve(principal, { teamId: TEAM_A });
    expect(after.has(Permission.MemberRolesManage)).toBe(true);
  });

  it('denies all permissions for an inactive principal', async () => {
    const userId = await seedUser(activeDataSource, 'suspended');
    const coach = await findRole(RbacRole.Coach);
    await assign(userId, coach, TEAM_A);

    const { resolver } = buildResolver(activeDataSource);
    const granted = await resolver.resolve(
      { userId, email: 'x@example.test', roles: [Role.Admin] },
      { teamId: TEAM_A },
    );

    expect(granted.size).toBe(0);
  });
});
