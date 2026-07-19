import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { MeasurementAttemptRepository } from '@modules/measurements/infrastructure/measurement-attempt.repository';
import { MeasurementProtocolRepository } from '@modules/measurements/infrastructure/measurement-protocol.repository';
import { MeasurementSessionRepository } from '@modules/measurements/infrastructure/measurement-session.repository';
import { selectProtocolResult } from '@modules/measurements/lib/measurements.builders';
import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ResultPolicy,
} from '@modules/measurements/model/measurements.enums';
import type {
  NewAttempt,
  ProtocolContent,
} from '@modules/measurements/model/measurements.types';
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
import { PracticeAgendasSchema1722100000000 } from '../../src/database/migrations/1722100000000-practice-agendas-schema';
import { PracticeRemindersCalendarSchema1722200000000 } from '../../src/database/migrations/1722200000000-practice-reminders-calendar-schema';
import { AssessmentCatalogSchema1722300000000 } from '../../src/database/migrations/1722300000000-assessment-catalog-schema';
import { PlayerAssessmentSchema1722400000000 } from '../../src/database/migrations/1722400000000-player-assessment-schema';
import { DevelopmentSchema1722500000000 } from '../../src/database/migrations/1722500000000-development-schema';
import { SeedHistorySchema1722600000000 } from '../../src/database/migrations/1722600000000-seed-history-schema';
import { ScoringSchema1722700000000 } from '../../src/database/migrations/1722700000000-scoring-schema';
import { MeasurementsSchema1722800000000 } from '../../src/database/migrations/1722800000000-measurements-schema';

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

const NOW = new Date('2026-06-01T09:00:00.000Z');
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
  PracticeAgendasSchema1722100000000,
  PracticeRemindersCalendarSchema1722200000000,
  AssessmentCatalogSchema1722300000000,
  PlayerAssessmentSchema1722400000000,
  DevelopmentSchema1722500000000,
  SeedHistorySchema1722600000000,
  ScoringSchema1722700000000,
  MeasurementsSchema1722800000000,
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

function protocolContent(
  overrides: Partial<ProtocolContent> = {},
): ProtocolContent {
  return {
    protocolKey: `sprint_${randomUUID().slice(0, 8)}`,
    name: '20 m sprint',
    description: null,
    seasonId: null,
    discipline: MeasurementDiscipline.Speed,
    unit: MeasurementUnit.Seconds,
    direction: MeasurementDirection.BetterLower,
    resultPolicy: ResultPolicy.Best,
    instructions: null,
    safetyNotes: null,
    minValue: null,
    maxValue: null,
    ...overrides,
  };
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Measurements integration (PostgreSQL)'
  : `Measurements integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const protocols = new MeasurementProtocolRepository();
  const sessions = new MeasurementSessionRepository();
  const attempts = new MeasurementAttemptRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await active.undoLastMigration();
      remaining -= 1;
    }
    await active.destroy();
  });

  async function seedScope(): Promise<{
    teamId: string;
    membershipId: string;
  }> {
    const teamId = randomUUID();
    const userId = randomUUID();
    const membershipId = randomUUID();
    await active.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId}@example.test`],
    );
    await active.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, 'Natives')`,
      [teamId, `team-${teamId.slice(0, 8)}`],
    );
    await active.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [membershipId, teamId, userId],
    );
    return { teamId, membershipId };
  }

  function attemptRow(
    sessionId: string,
    teamId: string,
    membershipId: string,
    protocolId: string,
    attemptNumber: number,
    canonicalValue: number | null,
  ): NewAttempt {
    return {
      id: randomUUID(),
      sessionId,
      teamId,
      membershipId,
      protocolId,
      attemptNumber,
      rawValue: canonicalValue,
      unit: MeasurementUnit.Seconds,
      canonicalValue,
      valid: true,
      disqualified: false,
      dqReason: null,
      evaluatorUserId: null,
      notes: null,
      now: NOW,
    };
  }

  it('seeds the global objective-protocol catalog', async () => {
    const rows = await active.query(
      `SELECT "protocol_key", "team_id", "direction" FROM "measurement_protocols"
        WHERE "team_id" IS NULL ORDER BY "protocol_key"`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const sprint = rows.find(
      (row: { protocol_key: string }) => row.protocol_key === 'sprint_20m',
    );
    expect(sprint?.direction).toBe('better_lower');
  });

  it('records attempts and derives the best per policy', async () => {
    const scope = await seedScope();
    const outcome = await unitOfWork.runInTransaction(async tx => {
      const protocol = await protocols.insert(tx, {
        id: randomUUID(),
        teamId: scope.teamId,
        content: protocolContent(),
        createdBy: null as never,
        now: NOW,
      });
      const session = await sessions.insert(tx, {
        id: randomUUID(),
        teamId: scope.teamId,
        content: {
          title: 'Combine',
          seasonId: null,
          scheduledAt: NOW.toISOString(),
          location: null,
          conditions: null,
          notes: null,
        },
        createdBy: null as never,
        now: NOW,
      });
      await attempts.insertMany(tx, [
        attemptRow(
          session.id,
          scope.teamId,
          scope.membershipId,
          protocol.id,
          1,
          3.4,
        ),
        attemptRow(
          session.id,
          scope.teamId,
          scope.membershipId,
          protocol.id,
          2,
          3.1,
        ),
        attemptRow(
          session.id,
          scope.teamId,
          scope.membershipId,
          protocol.id,
          3,
          null,
        ),
      ]);
      const persisted = await attempts.listForTarget(
        tx,
        session.id,
        scope.membershipId,
        protocol.id,
      );
      return selectProtocolResult(protocol, persisted);
    });
    expect(outcome.best).toBe(3.1);
    expect(outcome.consideredCount).toBe(2);
    expect(outcome.excludedCount).toBe(1);
  });

  it('enforces null-not-zero: raw and canonical must both be null or both set', async () => {
    const scope = await seedScope();
    const sessionId = randomUUID();
    const protocolId = randomUUID();
    await active.query(
      `INSERT INTO "measurement_protocols"
        ("id", "team_id", "protocol_key", "name", "discipline", "unit", "direction")
       VALUES ($1, $2, $3, 'P', 'speed', 'seconds', 'better_lower')`,
      [protocolId, scope.teamId, `p_${randomUUID().slice(0, 8)}`],
    );
    await active.query(
      `INSERT INTO "measurement_sessions"
        ("id", "team_id", "title", "scheduled_at") VALUES ($1, $2, 'S', now())`,
      [sessionId, scope.teamId],
    );
    await expect(
      active.query(
        `INSERT INTO "measurement_attempts"
          ("id", "session_id", "team_id", "membership_id", "protocol_id",
           "attempt_number", "raw_value", "unit", "canonical_value")
         VALUES ($1, $2, $3, $4, $5, 1, NULL, 'seconds', 5)`,
        [randomUUID(), sessionId, scope.teamId, scope.membershipId, protocolId],
      ),
    ).rejects.toThrow();
  });

  it('rejects a duplicate attempt ordinal for the same target', async () => {
    const scope = await seedScope();
    const sessionId = randomUUID();
    const protocolId = randomUUID();
    await active.query(
      `INSERT INTO "measurement_protocols"
        ("id", "team_id", "protocol_key", "name", "discipline", "unit", "direction")
       VALUES ($1, $2, $3, 'P', 'speed', 'seconds', 'better_lower')`,
      [protocolId, scope.teamId, `p_${randomUUID().slice(0, 8)}`],
    );
    await active.query(
      `INSERT INTO "measurement_sessions"
        ("id", "team_id", "title", "scheduled_at") VALUES ($1, $2, 'S', now())`,
      [sessionId, scope.teamId],
    );
    const insertAttempt = (): Promise<unknown> =>
      active.query(
        `INSERT INTO "measurement_attempts"
          ("id", "session_id", "team_id", "membership_id", "protocol_id",
           "attempt_number", "unit")
         VALUES ($1, $2, $3, $4, $5, 1, 'seconds')`,
        [randomUUID(), sessionId, scope.teamId, scope.membershipId, protocolId],
      );
    await insertAttempt();
    await expect(insertAttempt()).rejects.toThrow();
  });

  it('allows at most one active protocol per team and key', async () => {
    const scope = await seedScope();
    const key = `agility_${randomUUID().slice(0, 8)}`;
    const insertActive = (): Promise<unknown> =>
      active.query(
        `INSERT INTO "measurement_protocols"
          ("id", "team_id", "protocol_key", "name", "discipline", "unit",
           "direction", "status")
         VALUES ($1, $2, $3, 'P', 'agility', 'seconds', 'better_lower', 'active')`,
        [randomUUID(), scope.teamId, key],
      );
    await insertActive();
    await expect(insertActive()).rejects.toThrow();
  });
});
