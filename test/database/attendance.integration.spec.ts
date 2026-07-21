import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { AttendanceMembershipRepository } from '@modules/practices/infrastructure/attendance-membership.repository';
import { AttendanceRecordRepository } from '@modules/practices/infrastructure/attendance-record.repository';
import { AttendanceRecordRevisionRepository } from '@modules/practices/infrastructure/attendance-record-revision.repository';
import { AttendanceScoringRuleRepository } from '@modules/practices/infrastructure/attendance-scoring-rule.repository';
import { AttendanceSheetRepository } from '@modules/practices/infrastructure/attendance-sheet.repository';
import {
  AttendanceSource,
  AttendanceStatus,
} from '@modules/practices/model/attendance.enums';
import type {
  NewAttendanceRecord,
  NewAttendanceSheet,
} from '@modules/practices/model/attendance.types';
import { NodeEnv } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';
import { PlatformSchema1721700000000 } from '../../src/database/migrations/1721700000000-platform-schema';
import { PracticesSchema1721800000000 } from '../../src/database/migrations/1721800000000-practices-schema';
import { PracticeRsvpSchema1721900000000 } from '../../src/database/migrations/1721900000000-practice-rsvp-schema';
import { AttendanceSchema1722000000000 } from '../../src/database/migrations/1722000000000-attendance-schema';
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
const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformSchema1721700000000,
  PracticesSchema1721800000000,
  PracticeRsvpSchema1721900000000,
  AttendanceSchema1722000000000,
  PlatformLifecycleSchema1723800000000,
];

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: MIGRATIONS,
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    return dataSource;
  } catch {
    return null;
  }
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Attendance integration (PostgreSQL)'
  : `Attendance integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

interface Scope {
  readonly teamId: string;
  readonly seasonId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly sheetId: string;
  readonly memberA: string;
  readonly memberB: string;
}

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const sheets = new AttendanceSheetRepository();
  const records = new AttendanceRecordRepository();
  const revisions = new AttendanceRecordRevisionRepository();
  const rules = new AttendanceScoringRuleRepository();
  const memberships = new AttendanceMembershipRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await activeDataSource.undoLastMigration();
      remaining -= 1;
    }
    await activeDataSource.destroy();
  });

  async function seedScope(): Promise<Scope> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const sheetId = randomUUID();
    const memberA = randomUUID();
    const memberB = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, 'Natives')`,
      [teamId, `team-${teamId.slice(0, 8)}`],
    );
    await activeDataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on", "ends_on")
       VALUES ($1, $2, 'spring', 'Spring', '2026-01-01', '2026-06-30')`,
      [seasonId, teamId],
    );
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId.slice(0, 8)}@example.test`],
    );
    await activeDataSource.query(
      `INSERT INTO "practice_sessions" ("id", "team_id", "season_id",
              "session_type", "starts_at", "ends_at", "status")
       VALUES ($1, $2, $3, 'practice', $4, $5, 'completed')`,
      [
        sessionId,
        teamId,
        seasonId,
        '2026-06-05T16:00:00.000Z',
        '2026-06-05T18:00:00.000Z',
      ],
    );
    await activeDataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active'), ($4, $2, NULL, 'active')`,
      [memberA, teamId, userId, memberB],
    );
    return { teamId, seasonId, userId, sessionId, sheetId, memberA, memberB };
  }

  function newSheet(scope: Scope): NewAttendanceSheet {
    return {
      id: scope.sheetId,
      sessionId: scope.sessionId,
      teamId: scope.teamId,
      seasonId: scope.seasonId,
      createdBy: scope.userId,
      now: NOW,
    };
  }

  function newRecord(
    scope: Scope,
    membershipId: string,
    overrides: Partial<NewAttendanceRecord>,
  ): NewAttendanceRecord {
    return {
      id: randomUUID(),
      sheetId: scope.sheetId,
      sessionId: scope.sessionId,
      teamId: scope.teamId,
      seasonId: scope.seasonId,
      membershipId,
      userId: scope.userId,
      status: AttendanceStatus.PresentOnTime,
      checkInAt: null,
      checkOutAt: null,
      latenessMinutes: null,
      excuseCategory: null,
      note: null,
      evidenceRef: null,
      source: AttendanceSource.Coach,
      recordedBy: scope.userId,
      recordedAt: NOW,
      createdBy: scope.userId,
      now: NOW,
      ...overrides,
    };
  }

  it('migrates from empty and drops the attendance schema reversibly', async () => {
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.attendance_records') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    // Two steps back: the trailing platform-lifecycle migration (a pure ALTER
    // on teams/seasons) first, then this schema, which drops its own tables.
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.attendance_records') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('seeds exactly one default legacy-candidate scoring rule', async () => {
    const rule = await unitOfWork.runInTransaction(scope =>
      rules.findDefault(scope),
    );
    expect(rule?.code).toBe('legacy-candidate-v1');
    expect(rule?.weights).toEqual({
      practice: 3,
      fitness: 2,
      game: 3,
      throwing: 4,
    });
    expect(rule?.excusedExcluded).toBe(true);

    const none = await unitOfWork.runInTransaction(async scope => {
      await scope.run(
        `UPDATE "attendance_scoring_rules" SET "is_default" = false`,
      );
      const result = await rules.findDefault(scope);
      await scope.run(
        `UPDATE "attendance_scoring_rules" SET "is_default" = true
          WHERE "code" = 'legacy-candidate-v1'`,
      );
      return result;
    });
    expect(none).toBeNull();
  });

  it('creates a sheet idempotently and reads it back', async () => {
    const scope = await seedScope();
    const created = await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    expect(created?.state).toBe('open');

    const duplicate = await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    expect(duplicate).toBeNull();

    const found = await unitOfWork.runInTransaction(scope2 =>
      sheets.findBySession(scope2, scope.sessionId),
    );
    expect(found?.id).toBe(scope.sheetId);

    const missing = await unitOfWork.runInTransaction(scope2 =>
      sheets.findBySession(scope2, randomUUID()),
    );
    expect(missing).toBeNull();
  });

  it('finalizes and corrects a sheet under version + state guards', async () => {
    const scope = await seedScope();
    await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );

    const stale = await unitOfWork.runInTransaction(scope2 =>
      sheets.finalize(scope2, {
        id: scope.sheetId,
        finalizedBy: scope.userId,
        expectedVersion: 99,
        now: NOW,
      }),
    );
    expect(stale).toBeNull();

    const finalized = await unitOfWork.runInTransaction(scope2 =>
      sheets.finalize(scope2, {
        id: scope.sheetId,
        finalizedBy: scope.userId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(finalized?.state).toBe('finalized');
    expect(finalized?.version).toBe(2);

    const corrected = await unitOfWork.runInTransaction(scope2 =>
      sheets.applyCorrection(scope2, {
        id: scope.sheetId,
        updatedBy: scope.userId,
        now: NOW,
      }),
    );
    expect(corrected?.state).toBe('corrected');
  });

  it('refuses to correct an open sheet', async () => {
    const scope = await seedScope();
    await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    const result = await unitOfWork.runInTransaction(scope2 =>
      sheets.applyCorrection(scope2, {
        id: scope.sheetId,
        updatedBy: scope.userId,
        now: NOW,
      }),
    );
    expect(result).toBeNull();
  });

  it('inserts, reads, version-guards a record; duplicate is null', async () => {
    const scope = await seedScope();
    await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    const created = await unitOfWork.runInTransaction(scope2 =>
      records.insert(scope2, newRecord(scope, scope.memberA, {})),
    );
    expect(created?.status).toBe(AttendanceStatus.PresentOnTime);

    const duplicate = await unitOfWork.runInTransaction(scope2 =>
      records.insert(scope2, newRecord(scope, scope.memberA, {})),
    );
    expect(duplicate).toBeNull();

    const found = await unitOfWork.runInTransaction(scope2 =>
      records.findBySessionMembership(scope2, scope.sessionId, scope.memberA),
    );
    expect(found?.id).toBe(created?.id);

    const missing = await unitOfWork.runInTransaction(scope2 =>
      records.findBySessionMembership(scope2, scope.sessionId, randomUUID()),
    );
    expect(missing).toBeNull();

    const stale = await unitOfWork.runInTransaction(scope2 =>
      records.update(scope2, {
        id: created?.id ?? '',
        status: AttendanceStatus.PresentLate,
        checkInAt: NOW,
        checkOutAt: null,
        latenessMinutes: 10,
        excuseCategory: null,
        note: null,
        evidenceRef: null,
        source: AttendanceSource.Coach,
        recordedBy: scope.userId,
        recordedAt: NOW,
        updatedBy: scope.userId,
        expectedVersion: 99,
        now: NOW,
      }),
    );
    expect(stale).toBeNull();

    const updated = await unitOfWork.runInTransaction(scope2 =>
      records.update(scope2, {
        id: created?.id ?? '',
        status: AttendanceStatus.PresentLate,
        checkInAt: NOW,
        checkOutAt: null,
        latenessMinutes: 10,
        excuseCategory: null,
        note: null,
        evidenceRef: null,
        source: AttendanceSource.Coach,
        recordedBy: scope.userId,
        recordedAt: NOW,
        updatedBy: scope.userId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(updated?.status).toBe(AttendanceStatus.PresentLate);
    expect(updated?.latenessMinutes).toBe(10);
    expect(updated?.version).toBe(2);
  });

  it('projects the roster with unmarked members as null status', async () => {
    const scope = await seedScope();
    await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    await unitOfWork.runInTransaction(scope2 =>
      records.insert(scope2, newRecord(scope, scope.memberA, {})),
    );

    const roster = await unitOfWork.runInTransaction(scope2 =>
      records.listRoster(scope2, scope.teamId, scope.sessionId, {
        limit: 20,
        offset: 0,
      }),
    );
    expect(roster).toHaveLength(2);
    const marked = roster.find(row => row.membershipId === scope.memberA);
    const unmarked = roster.find(row => row.membershipId === scope.memberB);
    expect(marked?.status).toBe(AttendanceStatus.PresentOnTime);
    expect(unmarked?.status).toBeNull();

    const total = await unitOfWork.runInTransaction(scope2 =>
      records.countRoster(scope2, scope.teamId),
    );
    expect(total).toBe(2);

    const count = await unitOfWork.runInTransaction(scope2 =>
      records.countBySession(scope2, scope.sessionId),
    );
    expect(count).toBe(1);
  });

  it('projects participation facts only from finalized sheets', async () => {
    const scope = await seedScope();
    await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    await unitOfWork.runInTransaction(scope2 =>
      records.insert(scope2, newRecord(scope, scope.memberA, {})),
    );

    const beforeFinalize = await unitOfWork.runInTransaction(scope2 =>
      records.participationFacts(
        scope2,
        scope.teamId,
        scope.memberA,
        null,
        2000,
      ),
    );
    expect(beforeFinalize).toEqual([]);

    await unitOfWork.runInTransaction(scope2 =>
      sheets.finalize(scope2, {
        id: scope.sheetId,
        finalizedBy: scope.userId,
        expectedVersion: 1,
        now: NOW,
      }),
    );

    const facts = await unitOfWork.runInTransaction(scope2 =>
      records.participationFacts(
        scope2,
        scope.teamId,
        scope.memberA,
        scope.seasonId,
        2000,
      ),
    );
    expect(facts).toEqual([
      {
        status: AttendanceStatus.PresentOnTime,
        sessionType: 'practice',
        count: 1,
      },
    ]);
  });

  it('appends and reads a record revision history oldest-first', async () => {
    const scope = await seedScope();
    await unitOfWork.runInTransaction(scope2 =>
      sheets.insertSheet(scope2, newSheet(scope)),
    );
    const created = await unitOfWork.runInTransaction(scope2 =>
      records.insert(scope2, newRecord(scope, scope.memberA, {})),
    );
    await unitOfWork.runInTransaction(scope2 =>
      revisions.append(scope2, {
        id: randomUUID(),
        recordId: created?.id ?? '',
        sessionId: scope.sessionId,
        membershipId: scope.memberA,
        fromStatus: null,
        toStatus: AttendanceStatus.PresentOnTime,
        latenessMinutes: null,
        excuseCategory: null,
        source: AttendanceSource.Coach,
        isCorrection: false,
        correctionReason: null,
        actorUserId: scope.userId,
        now: NOW,
      }),
    );
    const history = await unitOfWork.runInTransaction(scope2 =>
      revisions.listBySessionMembership(
        scope2,
        scope.sessionId,
        scope.memberA,
        500,
      ),
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.toStatus).toBe(AttendanceStatus.PresentOnTime);
  });

  it('resolves memberships for record, self, and correction writes', async () => {
    const scope = await seedScope();
    const result = await unitOfWork.runInTransaction(async scope2 => ({
      byUser: await memberships.findActiveByUser(
        scope2,
        scope.teamId,
        scope.userId,
      ),
      byUserMissing: await memberships.findActiveByUser(
        scope2,
        scope.teamId,
        randomUUID(),
      ),
      byId: await memberships.findActiveById(
        scope2,
        scope.teamId,
        scope.memberA,
      ),
      byIdMissing: await memberships.findActiveById(
        scope2,
        scope.teamId,
        randomUUID(),
      ),
      inTeam: await memberships.findByIdInTeam(
        scope2,
        scope.teamId,
        scope.memberB,
      ),
      inTeamMissing: await memberships.findByIdInTeam(
        scope2,
        scope.teamId,
        randomUUID(),
      ),
    }));
    expect(result.byUser?.id).toBe(scope.memberA);
    expect(result.byUserMissing).toBeNull();
    expect(result.byId?.id).toBe(scope.memberA);
    expect(result.byIdMissing).toBeNull();
    expect(result.inTeam?.id).toBe(scope.memberB);
    expect(result.inTeamMissing).toBeNull();
  });
});
