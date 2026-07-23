import { randomUUID } from 'node:crypto';

import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { buildDataSourceOptions } from '@app/database/data-source.factory';
import type { DatabaseConfig } from '@config/config.types';
import { AUTH_TOKEN_PORT, type AuthTokenPort } from '@core/auth';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Role } from '@shared/enums';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../src/database/migrations/1721500000000-teams-schema';
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
import {
  AUDIT_NONSENSE_PAYLOAD,
  VALID_ATTENDANCE_STATUSES,
  VALID_ATTENDANCE_WEIGHTS,
  VALID_BADGE_TIERS,
  VALID_SETTING_DOCUMENTS,
} from './fixtures/setting-values.fixture';

const TEST_DB_HOST = process.env['TEST_DB_HOST'] ?? '127.0.0.1';
const TEST_DB_PORT = process.env['TEST_DB_PORT'] ?? '55432';
const TEST_DB_USER = process.env['TEST_DB_USERNAME'] ?? 'natives_test';
const TEST_DB_PASSWORD = process.env['TEST_DB_PASSWORD'] ?? 'natives_test';
const TEST_DB_NAME = process.env['TEST_DB_NAME'] ?? 'natives_test';
const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ??
  `postgres://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${TEST_DB_NAME}`;

const TEST_DB_CONFIG: DatabaseConfig = {
  url: TEST_DB_URL,
  host: TEST_DB_HOST,
  port: Number(TEST_DB_PORT),
  username: TEST_DB_USER,
  password: TEST_DB_PASSWORD,
  name: TEST_DB_NAME,
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SETTINGS_NOTE = 'p2 typed settings e2e';
// Egyptian DST boundaries (UTC instants), both in the future for this suite:
// spring-forward 2027: Cairo 2027-04-30 00:00 (+02) jumps to 01:00 (+03).
const SPRING_FORWARD_UTC = '2027-04-29T22:00:00.000Z';
// autumn fall-back 2026: Cairo 2026-10-29 00:00 (+03) folds back to 23:00 (+02).
const FALL_BACK_UTC = '2026-10-28T21:00:00.000Z';

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
}

function futureIso(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

async function seedUser(dataSource: DataSource, role: Role): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
    [id, `user-${id}@example.test`, role],
  );
  return id;
}

async function migrateAndSeed(): Promise<Fixture | null> {
  try {
    const dataSource = new DataSource({
      ...buildDataSourceOptions(TEST_DB_CONFIG),
      migrations: [
        BaselineSchema1721200000000,
        IdentitySchema1721300000000,
        RbacSchema1721400000000,
        TeamsSchema1721500000000,
        PlatformLifecycleSchema1723800000000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    const adminId = await seedUser(dataSource, Role.Admin);
    const memberId = await seedUser(dataSource, Role.User);
    return { dataSource, adminId, memberId };
  } catch {
    return null;
  }
}

const ORIGINAL_DATABASE_URL = process.env['DATABASE_URL'];
process.env['DATABASE_URL'] = TEST_DB_URL;
const seeded = await migrateAndSeed();
const seededDataSource = seeded?.dataSource ?? null;

const describeIfDb = seededDataSource ? describe : describe.skip;
const suiteTitle = seededDataSource
  ? 'Team settings — typed values, scheduling, legacy (e2e, PostgreSQL)'
  : `Team settings (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let adminToken: string;
  let memberToken: string;

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function createTeam(): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `st-${randomUUID().slice(0, 12)}`, name: 'Settings Team' });
    expect(created.status).toBe(201);
    return created.body.id as string;
  }

  function postVersion(
    teamId: string,
    body: Readonly<Record<string, unknown>>,
  ): request.Test {
    return request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/settings/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: SETTINGS_NOTE, ...body });
  }

  async function snapshotAt(
    teamId: string,
    asOf: string | null,
  ): Promise<request.Response> {
    const path =
      asOf === null
        ? `/api/v1/teams/${teamId}/settings/snapshot`
        : `/api/v1/teams/${teamId}/settings/snapshot?asOf=${asOf}`;
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    return response;
  }

  function settingIn(
    snapshot: request.Response,
    key: string,
  ): Record<string, unknown> {
    const entry = (
      snapshot.body.settings as readonly Record<string, unknown>[]
    ).find(candidate => candidate['settingKey'] === key);
    expect(entry).toBeDefined();
    return entry ?? {};
  }

  async function seedPositions(teamId: string): Promise<void> {
    for (const key of ['handler', 'cutter']) {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/teams/${teamId}/catalog-entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ catalog: 'position', key, label: key });
      expect(created.status).toBe(201);
    }
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    memberToken = await tokenFor(fixture.memberId, [Role.User]);
  });

  afterAll(async () => {
    await app.close();
    if (seededDataSource) {
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.destroy();
    }
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  it('accepts a valid typed create for every key and serves it at the effective instant', async () => {
    const teamId = await createTeam();
    await seedPositions(teamId);
    const effectiveFrom = futureIso(1);

    for (const [key, document] of Object.entries(VALID_SETTING_DOCUMENTS)) {
      const created = await postVersion(teamId, {
        settingKey: key,
        effectiveFrom,
        value: document,
      });
      expect(created.status, `expected 201 for ${key}`).toBe(201);
      expect(created.body.valueState).toBe('valid');
      expect(created.body.value).toEqual(document);
    }

    // Before the effective instant nothing is configured (null-not-zero).
    const before = await snapshotAt(teamId, null);
    for (const key of Object.keys(VALID_SETTING_DOCUMENTS)) {
      expect(settingIn(before, key)['value']).toBeNull();
      expect(settingIn(before, key)['valueState']).toBeNull();
    }

    const after = await snapshotAt(teamId, futureIso(2));
    for (const [key, document] of Object.entries(VALID_SETTING_DOCUMENTS)) {
      const entry = settingIn(after, key);
      expect(entry['value'], `expected snapshot value for ${key}`).toEqual(
        document,
      );
      expect(entry['valueState']).toBe('valid');
      expect(entry['issues']).toEqual([]);
    }
  });

  it('rejects the audit nonsense payload with 400 settingValueInvalid (regression)', async () => {
    const teamId = await createTeam();
    const response = await postVersion(teamId, {
      settingKey: 'attendance_statuses',
      effectiveFrom: futureIso(1),
      value: AUDIT_NONSENSE_PAYLOAD,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.teams.settingValueInvalid');
  });

  it('rejects weights scheduled before any statuses exist (D3)', async () => {
    const teamId = await createTeam();
    const response = await postVersion(teamId, {
      settingKey: 'attendance_weights',
      effectiveFrom: futureIso(1),
      value: VALID_ATTENDANCE_WEIGHTS,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.teams.settingValueInvalid');
    expect(response.body.message).toContain('statuses_not_configured');
  });

  it('rejects weights keyed by a status unknown to the effective statuses', async () => {
    const teamId = await createTeam();
    const effectiveFrom = futureIso(1);
    const statuses = await postVersion(teamId, {
      settingKey: 'attendance_statuses',
      effectiveFrom,
      value: VALID_ATTENDANCE_STATUSES,
    });
    expect(statuses.status).toBe(201);

    const response = await postVersion(teamId, {
      settingKey: 'attendance_weights',
      effectiveFrom,
      value: { weights: { present_on_time: 1, absent: 0, injured: 0.5 } },
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('weights_unknown_status:injured');
  });

  it('surfaces weight-coverage issues on the snapshot after statuses drift (D3)', async () => {
    const teamId = await createTeam();
    const effectiveFrom = futureIso(1);
    await postVersion(teamId, {
      settingKey: 'attendance_statuses',
      effectiveFrom,
      value: VALID_ATTENDANCE_STATUSES,
    });
    await postVersion(teamId, {
      settingKey: 'attendance_weights',
      effectiveFrom,
      value: VALID_ATTENDANCE_WEIGHTS,
    });

    // A LATER statuses write activating a new counts-toward status is not
    // blocked by the existing weights; the snapshot surfaces the gap instead.
    const remoteActive = {
      statuses: [
        ...(VALID_ATTENDANCE_STATUSES['statuses'] as readonly unknown[]),
        {
          code: 'remote_approved',
          labelEn: 'Remote',
          labelAr: 'عن بعد',
          color: 'accent1',
          countsTowardMetrics: true,
          allowSelfCheckIn: false,
          active: true,
        },
      ],
    };
    const laterStatuses = await postVersion(teamId, {
      settingKey: 'attendance_statuses',
      effectiveFrom: futureIso(5),
      value: remoteActive,
    });
    expect(laterStatuses.status).toBe(201);

    const drifted = await snapshotAt(teamId, futureIso(6));
    const weights = settingIn(drifted, 'attendance_weights');
    expect(weights['issues']).toContain(
      'weights_missing_status:remote_approved',
    );

    const consistent = await snapshotAt(teamId, futureIso(2));
    expect(settingIn(consistent, 'attendance_weights')['issues']).toEqual([]);
  });

  it('schedules a future version without rewriting the present', async () => {
    const teamId = await createTeam();
    const current = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(1),
      value: VALID_BADGE_TIERS,
    });
    expect(current.status).toBe(201);

    const futureTiers = {
      tiers: [
        {
          key: 'platinum',
          labelEn: 'Platinum',
          labelAr: 'بلاتيني',
          threshold: 1000,
          color: 'accent3',
        },
      ],
    };
    const scheduled = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(5),
      value: futureTiers,
    });
    expect(scheduled.status).toBe(201);

    const beforeSwitch = await snapshotAt(teamId, futureIso(2));
    expect(settingIn(beforeSwitch, 'badge_tiers')['value']).toEqual(
      VALID_BADGE_TIERS,
    );
    const afterSwitch = await snapshotAt(teamId, futureIso(6));
    expect(settingIn(afterSwitch, 'badge_tiers')['value']).toEqual(futureTiers);
  });

  it('cancels a future version (204 + audit) but never one in effect (409)', async () => {
    const teamId = await createTeam();
    const keeper = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(1),
      value: VALID_BADGE_TIERS,
    });
    const doomed = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(5),
      value: { tiers: [(VALID_BADGE_TIERS['tiers'] as unknown[])[0]] },
    });
    expect(keeper.status).toBe(201);
    expect(doomed.status).toBe(201);

    const cancelled = await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}/settings/versions/${doomed.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cancelled.status).toBe(204);

    const after = await snapshotAt(teamId, futureIso(6));
    expect(settingIn(after, 'badge_tiers')['value']).toEqual(VALID_BADGE_TIERS);

    const audit = await fixture.dataSource.query(
      `SELECT "id" FROM "security_events"
        WHERE "event_type" = 'team.settingVersionCancelled'
          AND "context" ->> 'settingVersionId' = $1`,
      [doomed.body.id],
    );
    expect(audit).toHaveLength(1);

    const again = await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}/settings/versions/${doomed.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(again.status).toBe(404);
    expect(again.body.messageKey).toBe('errors.teams.settingVersionNotFound');

    // Inside the clock-skew grace an instant slightly in the past is accepted —
    // and is immediately in effect, so it can never be cancelled.
    const inEffect = await postVersion(teamId, {
      settingKey: 'session_types',
      effectiveFrom: new Date(Date.now() - 4 * MINUTE_MS).toISOString(),
      value: VALID_SETTING_DOCUMENTS['session_types'],
    });
    expect(inEffect.status).toBe(201);
    const refused = await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}/settings/versions/${inEffect.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(refused.status).toBe(409);
    expect(refused.body.messageKey).toBe(
      'errors.teams.settingVersionNotCancellable',
    );
  });

  it('rejects a duplicate effective instant (409) and a stale head guard (D8)', async () => {
    const teamId = await createTeam();
    const effectiveFrom = futureIso(1);
    const first = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom,
      value: VALID_BADGE_TIERS,
    });
    expect(first.status).toBe(201);

    const duplicate = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom,
      value: VALID_BADGE_TIERS,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.messageKey).toBe(
      'errors.teams.settingVersionConflict',
    );

    const guarded = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(2),
      value: VALID_BADGE_TIERS,
      expectedHeadVersionId: first.body.id,
    });
    expect(guarded.status).toBe(201);

    // Two admins raced from the same head: the second write must lose.
    const stale = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(3),
      value: VALID_BADGE_TIERS,
      expectedHeadVersionId: first.body.id,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.messageKey).toBe('errors.teams.settingVersionStale');

    const nullGuard = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(4),
      value: VALID_BADGE_TIERS,
      expectedHeadVersionId: null,
    });
    expect(nullGuard.status).toBe(409);
  });

  it('serves a legacy row honestly and lets a valid version supersede it (D4)', async () => {
    const teamId = await createTeam();
    const legacyId = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "team_setting_versions"
         ("id", "team_id", "setting_key", "effective_from", "value", "note", "created_by", "created_at")
       VALUES ($1, $2, 'assessment_scale', $3, '{}'::jsonb, NULL, NULL, $4)`,
      [
        legacyId,
        teamId,
        new Date(Date.now() - HOUR_MS).toISOString(),
        new Date().toISOString(),
      ],
    );

    const versions = await request(app.getHttpServer())
      .get(
        `/api/v1/teams/${teamId}/settings/versions?settingKey=assessment_scale`,
      )
      .set('Authorization', `Bearer ${adminToken}`);
    expect(versions.status).toBe(200);
    expect(versions.body.items).toHaveLength(1);
    // The raw stored document stays visible for the replace flow…
    expect(versions.body.items[0].valueState).toBe('legacy');
    expect(versions.body.items[0].value).toEqual({});

    // …but the snapshot never serves it as an effective value.
    const now = await snapshotAt(teamId, null);
    const legacyEntry = settingIn(now, 'assessment_scale');
    expect(legacyEntry['value']).toBeNull();
    expect(legacyEntry['valueState']).toBe('legacy');

    const replacement = await postVersion(teamId, {
      settingKey: 'assessment_scale',
      effectiveFrom: futureIso(1),
      value: VALID_SETTING_DOCUMENTS['assessment_scale'],
    });
    expect(replacement.status).toBe(201);
    const after = await snapshotAt(teamId, futureIso(2));
    const replaced = settingIn(after, 'assessment_scale');
    expect(replaced['valueState']).toBe('valid');
    expect(replaced['value']).toEqual(
      VALID_SETTING_DOCUMENTS['assessment_scale'],
    );
  });

  it('requires a meaningful reason (D6)', async () => {
    const teamId = await createTeam();
    const missing = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/settings/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        settingKey: 'badge_tiers',
        effectiveFrom: futureIso(1),
        value: VALID_BADGE_TIERS,
      });
    expect(missing.status).toBe(400);

    const short = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: futureIso(1),
      value: VALID_BADGE_TIERS,
      note: 'meh',
    });
    expect(short.status).toBe(400);
  });

  it('rejects non-strict-UTC and backdated effective instants (D5)', async () => {
    const teamId = await createTeam();
    const offsetLess = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: '2026-07-22T12:00',
      value: VALID_BADGE_TIERS,
    });
    expect(offsetLess.status).toBe(400);

    const zoned = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: '2026-12-01T12:00:00+02:00',
      value: VALID_BADGE_TIERS,
    });
    expect(zoned.status).toBe(400);

    const backdated = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: new Date(Date.now() - 10 * MINUTE_MS).toISOString(),
      value: VALID_BADGE_TIERS,
    });
    expect(backdated.status).toBe(400);
    expect(backdated.body.messageKey).toBe(
      'errors.teams.settingEffectiveInPast',
    );
  });

  it('enforces authentication and per-permission access', async () => {
    const teamId = await createTeam();
    const anonymous = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/settings/snapshot`,
    );
    expect(anonymous.status).toBe(401);

    const read = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/settings/snapshot`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(read.status).toBe(403);
    expect(read.body.messageKey).toBe('errors.auth.permissionDenied');

    const write = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/settings/versions`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        settingKey: 'badge_tiers',
        effectiveFrom: futureIso(1),
        value: VALID_BADGE_TIERS,
        note: SETTINGS_NOTE,
      });
    expect(write.status).toBe(403);

    const cancel = await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}/settings/versions/${randomUUID()}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(cancel.status).toBe(403);
  });

  it('resolves the Egyptian spring-forward boundary deterministically in UTC', async () => {
    const teamId = await createTeam();
    const created = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: SPRING_FORWARD_UTC,
      value: VALID_BADGE_TIERS,
    });
    expect(created.status).toBe(201);

    const before = await snapshotAt(teamId, '2027-04-29T21:59:59.999Z');
    expect(settingIn(before, 'badge_tiers')['value']).toBeNull();
    const at = await snapshotAt(teamId, SPRING_FORWARD_UTC);
    expect(settingIn(at, 'badge_tiers')['value']).toEqual(VALID_BADGE_TIERS);
  });

  it('resolves the Egyptian fall-back (folded hour) boundary deterministically in UTC', async () => {
    const teamId = await createTeam();
    const created = await postVersion(teamId, {
      settingKey: 'badge_tiers',
      effectiveFrom: FALL_BACK_UTC,
      value: VALID_BADGE_TIERS,
    });
    expect(created.status).toBe(201);

    const before = await snapshotAt(teamId, '2026-10-28T20:59:59.999Z');
    expect(settingIn(before, 'badge_tiers')['value']).toBeNull();
    const after = await snapshotAt(teamId, '2026-10-28T21:00:00.000Z');
    expect(settingIn(after, 'badge_tiers')['value']).toEqual(VALID_BADGE_TIERS);
  });
});
