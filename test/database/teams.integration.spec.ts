import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { buildSettingsSnapshot } from '@modules/teams/domain/effective-settings.policy';
import { findOverlappingSeason } from '@modules/teams/domain/season-schedule.policy';
import { CatalogRepository } from '@modules/teams/infrastructure/catalog.repository';
import { SeasonRepository } from '@modules/teams/infrastructure/season.repository';
import { SettingVersionRepository } from '@modules/teams/infrastructure/setting-version.repository';
import { TeamRepository } from '@modules/teams/infrastructure/team.repository';
import { VenueRepository } from '@modules/teams/infrastructure/venue.repository';
import { CatalogName, SettingKey } from '@modules/teams/model/teams.enums';
import { NodeEnv, Role } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';

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

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: [
      BaselineSchema1721200000000,
      IdentitySchema1721300000000,
      RbacSchema1721400000000,
      TeamsSchema1721500000000,
      PlatformLifecycleSchema1723800000000,
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

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Teams integration (PostgreSQL)'
  : `Teams integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const teams = new TeamRepository();
  const seasons = new SeasonRepository();
  const venues = new VenueRepository();
  const catalog = new CatalogRepository();
  const settings = new SettingVersionRepository();

  afterAll(async () => {
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  async function seedUser(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [id, `user-${id}@example.test`, Role.Admin],
    );
    return id;
  }

  async function createTeam(actorId: string, slug: string): Promise<string> {
    return unitOfWork.runInTransaction(async scope => {
      const team = await teams.insert(scope, {
        id: randomUUID(),
        slug,
        name: `Team ${slug}`,
        locale: 'en',
        timezone: 'Africa/Cairo',
        primaryColor: null,
        logoMediaKey: null,
        createdBy: actorId,
        now: NOW,
      });
      return team.id;
    });
  }

  it('migrates from empty and drops the teams schema reversibly', async () => {
    await activeDataSource.runMigrations();

    const present = await activeDataSource.query(
      `SELECT to_regclass('public.teams') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    // Two steps back: the platform-lifecycle migration first (it only alters
    // teams/seasons), then the teams schema itself, which drops the table.
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.teams') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('constrains the team lifecycle and adds the soft-removal column', async () => {
    await activeDataSource.runMigrations();

    const columns = await activeDataSource.query(
      `SELECT "column_name" FROM information_schema.columns
        WHERE "table_name" = 'teams' AND "column_name" = 'deleted_at'`,
    );
    expect(columns).toHaveLength(1);

    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `lifecycle-${randomUUID()}`);
    await expect(
      activeDataSource.query(
        `UPDATE "teams" SET "status" = 'bogus' WHERE "id" = $1`,
        [teamId],
      ),
    ).rejects.toThrow(/ck_teams_status/u);
  });

  it('permits at most one active season per team', async () => {
    await activeDataSource.runMigrations();

    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `seasons-${randomUUID()}`);
    await activeDataSource.query(
      `INSERT INTO "seasons" ("team_id", "slug", "name", "starts_on", "ends_on", "status")
       VALUES ($1, 'a', 'A', '2030-01-01', '2030-06-30', 'active')`,
      [teamId],
    );

    await expect(
      activeDataSource.query(
        `INSERT INTO "seasons" ("team_id", "slug", "name", "starts_on", "ends_on", "status")
         VALUES ($1, 'b', 'B', '2030-07-01', '2030-12-31', 'active')`,
        [teamId],
      ),
    ).rejects.toThrow(/ux_seasons_one_active_per_team/u);
  });

  it('seeds the platform permissions and the SUPER_ADMIN bundle', async () => {
    await activeDataSource.runMigrations();

    const permissions = await activeDataSource.query(
      `SELECT "key" FROM "permissions"
        WHERE "key" IN ('platform.admin', 'team.create', 'team.browse.all')
        ORDER BY "key"`,
    );
    expect(permissions.map((row: { key: string }) => row.key)).toEqual([
      'platform.admin',
      'team.browse.all',
      'team.create',
    ]);

    const bundle = await activeDataSource.query(
      `SELECT COUNT(*)::int AS "count" FROM "role_permissions" rp
         JOIN "roles" r ON r."id" = rp."role_id"
        WHERE r."key" = 'SUPER_ADMIN'`,
    );
    const total = await activeDataSource.query(
      `SELECT COUNT(*)::int AS "count" FROM "permissions"`,
    );
    expect(bundle[0].count).toBe(total[0].count);
  });

  it('persists a team and enforces optimistic concurrency', async () => {
    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `opt-${randomUUID().slice(0, 8)}`);

    const stale = await unitOfWork.runInTransaction(scope =>
      teams.update(scope, {
        id: teamId,
        name: 'Renamed',
        locale: 'ar',
        timezone: 'Africa/Cairo',
        primaryColor: null,
        logoMediaKey: null,
        updatedBy: actorId,
        expectedVersion: 99,
        now: NOW,
      }),
    );
    expect(stale).toBeNull();

    const updated = await unitOfWork.runInTransaction(scope =>
      teams.update(scope, {
        id: teamId,
        name: 'Renamed',
        locale: 'ar',
        timezone: 'Africa/Cairo',
        primaryColor: null,
        logoMediaKey: null,
        updatedBy: actorId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(updated?.version).toBe(2);
  });

  it('reads season date ranges as calendar strings and detects overlap', async () => {
    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `ssn-${randomUUID().slice(0, 8)}`);

    await unitOfWork.runInTransaction(scope =>
      seasons.insert(scope, {
        id: randomUUID(),
        teamId,
        slug: 'spring',
        name: 'Spring',
        startsOn: '2026-01-01',
        endsOn: '2026-06-30',
        status: 'active' as never,
        createdBy: actorId,
        now: NOW,
      }),
    );

    const ranges = await unitOfWork.runInTransaction(scope =>
      seasons.listActiveRanges(scope, teamId, 1000),
    );
    expect(ranges[0]?.startsOn).toBe('2026-01-01');
    expect(ranges[0]?.endsOn).toBe('2026-06-30');
    expect(
      findOverlappingSeason(ranges, '2026-03-01', '2026-09-01', null),
    ).not.toBeNull();
    expect(
      findOverlappingSeason(ranges, '2026-07-01', '2026-08-31', null),
    ).toBeNull();
  });

  it('round-trips venue coordinates and preserves null (null-not-zero)', async () => {
    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `ven-${randomUUID().slice(0, 8)}`);

    const withCoords = await unitOfWork.runInTransaction(scope =>
      venues.insert(scope, {
        id: randomUUID(),
        teamId,
        name: 'Field A',
        address: null,
        timezone: 'Africa/Cairo',
        latitude: 30.05,
        longitude: 31.25,
        createdBy: actorId,
        now: NOW,
      }),
    );
    expect(withCoords.latitude).toBeCloseTo(30.05);

    const withoutCoords = await unitOfWork.runInTransaction(scope =>
      venues.insert(scope, {
        id: randomUUID(),
        teamId,
        name: 'Field B',
        address: null,
        timezone: 'Africa/Cairo',
        latitude: null,
        longitude: null,
        createdBy: actorId,
        now: NOW,
      }),
    );
    expect(withoutCoords.latitude).toBeNull();
  });

  it('creates catalog entries and tracks reference counts', async () => {
    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `cat-${randomUUID().slice(0, 8)}`);

    const entry = await unitOfWork.runInTransaction(scope =>
      catalog.insert(scope, {
        id: randomUUID(),
        teamId,
        catalog: CatalogName.Position,
        key: 'handler',
        label: 'Handler',
        sortOrder: 0,
        metadata: { line: 'offense' },
        createdBy: actorId,
        now: NOW,
      }),
    );
    expect(entry.referenceCount).toBe(0);
    expect(entry.metadata).toEqual({ line: 'offense' });

    const exists = await unitOfWork.runInTransaction(scope =>
      catalog.existsByKey(scope, teamId, 'position', 'handler'),
    );
    expect(exists).toBe(true);
  });

  it('resolves the effective setting version by date (golden)', async () => {
    const actorId = await seedUser();
    const teamId = await createTeam(actorId, `set-${randomUUID().slice(0, 8)}`);

    await unitOfWork.runInTransaction(async scope => {
      await settings.insert(scope, {
        id: randomUUID(),
        teamId,
        settingKey: SettingKey.AttendanceWeights,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        value: { throwing: 4 },
        note: 'v1',
        createdBy: actorId,
        now: NOW,
      });
      await settings.insert(scope, {
        id: randomUUID(),
        teamId,
        settingKey: SettingKey.AttendanceWeights,
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        value: { throwing: 5 },
        note: 'v2',
        createdBy: actorId,
        now: NOW,
      });
    });

    const inFebruary = await unitOfWork.runInTransaction(scope =>
      settings.loadEffective(
        scope,
        teamId,
        new Date('2026-02-15T00:00:00.000Z'),
      ),
    );
    const inApril = await unitOfWork.runInTransaction(scope =>
      settings.loadEffective(
        scope,
        teamId,
        new Date('2026-04-15T00:00:00.000Z'),
      ),
    );

    const febSnapshot = buildSettingsSnapshot(
      teamId,
      new Date('2026-02-15T00:00:00.000Z'),
      inFebruary,
    );
    const aprSnapshot = buildSettingsSnapshot(
      teamId,
      new Date('2026-04-15T00:00:00.000Z'),
      inApril,
    );

    const febWeights = febSnapshot.settings.find(
      s => s.settingKey === SettingKey.AttendanceWeights,
    );
    const aprWeights = aprSnapshot.settings.find(
      s => s.settingKey === SettingKey.AttendanceWeights,
    );
    expect(febWeights?.value).toEqual({ throwing: 4 });
    expect(aprWeights?.value).toEqual({ throwing: 5 });
  });
});
