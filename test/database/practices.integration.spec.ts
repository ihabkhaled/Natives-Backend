import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { PracticeScheduleRepository } from '@modules/practices/infrastructure/practice-schedule.repository';
import { PracticeScopeRepository } from '@modules/practices/infrastructure/practice-scope.repository';
import { PracticeSessionRepository } from '@modules/practices/infrastructure/practice-session.repository';
import { SessionStatusEventRepository } from '@modules/practices/infrastructure/session-status-event.repository';
import {
  RecurrenceFrequency,
  SessionStatus,
  SessionVisibility,
} from '@modules/practices/model/practices.enums';
import type {
  NewSchedule,
  NewSession,
} from '@modules/practices/model/practices.types';
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
import { ActivitiesSchema1722900000000 } from '../../src/database/migrations/1722900000000-activities-schema';
import { ActivityReviewSchema1723000000000 } from '../../src/database/migrations/1723000000000-activity-review-schema';
import { PointsSchema1723100000000 } from '../../src/database/migrations/1723100000000-points-schema';
import { LeaderboardIndexes1723200000000 } from '../../src/database/migrations/1723200000000-leaderboard-indexes';
import { CompetitionsSchema1723300000000 } from '../../src/database/migrations/1723300000000-competitions-schema';
import { SquadsSchema1723400000000 } from '../../src/database/migrations/1723400000000-squads-schema';
import { RostersSchema1723500000000 } from '../../src/database/migrations/1723500000000-rosters-schema';
import { MatchesSchema1723600000000 } from '../../src/database/migrations/1723600000000-matches-schema';
import { MatchLineupsSchema1723700000000 } from '../../src/database/migrations/1723700000000-match-lineups-schema';
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { VideoAnalysisSchema1723900000000 } from '../../src/database/migrations/1723900000000-video-analysis-schema';
import { StandingsSchema1724000000000 } from '../../src/database/migrations/1724000000000-standings-schema';
import { TryoutsSchema1724100000000 } from '../../src/database/migrations/1724100000000-tryouts-schema';
import { GovernanceSchema1724200000000 } from '../../src/database/migrations/1724200000000-governance-schema';
import { JerseysSchema1724300000000 } from '../../src/database/migrations/1724300000000-jerseys-schema';
import { AnalyticsSchema1724400000000 } from '../../src/database/migrations/1724400000000-analytics-schema';
import { ReportsSchema1724500000000 } from '../../src/database/migrations/1724500000000-reports-schema';
import { MigrationSchema1724600000000 } from '../../src/database/migrations/1724600000000-migration-schema';
import { DataQualitySchema1724700000000 } from '../../src/database/migrations/1724700000000-data-quality-schema';
import { InvitationsTeamScope1724800000000 } from '../../src/database/migrations/1724800000000-invitations-team-scope';
import { TeamAdminMatchScore1724900000000 } from '../../src/database/migrations/1724900000000-team-admin-match-score';
import { RbacRoleCatalogMetadata1725000000000 } from '../../src/database/migrations/1725000000000-rbac-role-catalog-metadata';
import { InvitationTeamRole1725100000000 } from '../../src/database/migrations/1725100000000-invitation-team-role';
import { JobHeartbeats1725200000000 } from '../../src/database/migrations/1725200000000-job-heartbeats';
import { OutboxDeadLetterTimestamp1725300000000 } from '../../src/database/migrations/1725300000000-outbox-dead-letter-timestamp';
import { GovernanceJerseyReadGrants1725400000000 } from '../../src/database/migrations/1725400000000-governance-jersey-read-grants';
import { AchievementRejectionReason1725500000000 } from '../../src/database/migrations/1725500000000-achievement-rejection-reason';
import { SignupReview1725600000000 } from '../../src/database/migrations/1725600000000-signup-review';
import { TeamStaffAssignments1725700000000 } from '../../src/database/migrations/1725700000000-team-staff-assignments';
import { TeamPublicProfile1725900000000 } from '../../src/database/migrations/1725900000000-team-public-profile';
import { MemberJerseyDisplay1726000000000 } from '../../src/database/migrations/1726000000000-member-jersey-display';
import { JerseyNumberAsText1726100000000 } from '../../src/database/migrations/1726100000000-jersey-number-as-text';
import { RosterJerseyTextAndNameFix1726200000000 } from '../../src/database/migrations/1726200000000-roster-jersey-text-and-name-fix';

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
  PracticeAgendasSchema1722100000000,
  PracticeRemindersCalendarSchema1722200000000,
  AssessmentCatalogSchema1722300000000,
  PlayerAssessmentSchema1722400000000,
  DevelopmentSchema1722500000000,
  SeedHistorySchema1722600000000,
  ScoringSchema1722700000000,
  MeasurementsSchema1722800000000,
  ActivitiesSchema1722900000000,
  ActivityReviewSchema1723000000000,
  PointsSchema1723100000000,
  LeaderboardIndexes1723200000000,
  CompetitionsSchema1723300000000,
  SquadsSchema1723400000000,
  RostersSchema1723500000000,
  MatchesSchema1723600000000,
  MatchLineupsSchema1723700000000,
  PlatformLifecycleSchema1723800000000,
  VideoAnalysisSchema1723900000000,
  StandingsSchema1724000000000,
  TryoutsSchema1724100000000,
  GovernanceSchema1724200000000,
  JerseysSchema1724300000000,
  AnalyticsSchema1724400000000,
  ReportsSchema1724500000000,
  MigrationSchema1724600000000,
  DataQualitySchema1724700000000,
  InvitationsTeamScope1724800000000,
  TeamAdminMatchScore1724900000000,
  RbacRoleCatalogMetadata1725000000000,
  InvitationTeamRole1725100000000,
  JobHeartbeats1725200000000,
  OutboxDeadLetterTimestamp1725300000000,
  GovernanceJerseyReadGrants1725400000000,
  AchievementRejectionReason1725500000000,
  SignupReview1725600000000,
  TeamStaffAssignments1725700000000,
  TeamPublicProfile1725900000000,
  MemberJerseyDisplay1726000000000,
  JerseyNumberAsText1726100000000,
  RosterJerseyTextAndNameFix1726200000000,
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
  ? 'Practices integration (PostgreSQL)'
  : `Practices integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

function baseSchedule(
  teamId: string,
  seasonId: string,
  venueId: string,
): NewSchedule {
  return {
    id: randomUUID(),
    teamId,
    seasonId,
    name: 'Weekly practice',
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    frequency: RecurrenceFrequency.Weekly,
    intervalWeeks: 1,
    weekdays: [1, 3],
    startTimeLocal: '18:00',
    durationMinutes: 90,
    meetOffsetMinutes: 30,
    rsvpCutoffMinutes: 120,
    defaultVenueId: venueId,
    defaultField: 'Field A',
    defaultCapacity: 24,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    generationStart: '2026-01-05',
    generationUntil: '2026-02-28',
    exceptions: ['2026-01-12'],
    createdBy: null,
    now: NOW,
  };
}

function baseSession(
  teamId: string,
  overrides: Partial<NewSession>,
): NewSession {
  return {
    id: randomUUID(),
    teamId,
    seasonId: null,
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: null,
    capacity: null,
    meetAt: null,
    startsAt: new Date('2026-01-15T16:00:00.000Z'),
    endsAt: new Date('2026-01-15T17:30:00.000Z'),
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status: SessionStatus.Draft,
    createdBy: null,
    now: NOW,
    ...overrides,
  };
}

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const schedules = new PracticeScheduleRepository();
  const sessions = new PracticeSessionRepository();
  const statusEvents = new SessionStatusEventRepository();
  const scopes = new PracticeScopeRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await activeDataSource.undoLastMigration();
      remaining -= 1;
    }
    await activeDataSource.destroy();
  });

  async function seedScope(): Promise<{
    teamId: string;
    seasonId: string;
    venueId: string;
  }> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const venueId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, $3)`,
      [teamId, `team-${teamId.slice(0, 8)}`, 'Natives'],
    );
    await activeDataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on", "ends_on")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [seasonId, teamId, 'spring', 'Spring', '2026-01-01', '2026-06-30'],
    );
    await activeDataSource.query(
      `INSERT INTO "venues" ("id", "team_id", "name") VALUES ($1, $2, $3)`,
      [venueId, teamId, `Field-${venueId.slice(0, 8)}`],
    );
    return { teamId, seasonId, venueId };
  }

  it('migrates from empty and drops the practices schema reversibly', async () => {
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.practice_sessions') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    // Two steps back: the trailing platform-lifecycle migration (a pure ALTER
    // on teams/seasons) first, then this schema, which drops its own tables.
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.practice_sessions') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('round-trips a schedule with array + calendar columns and enforces version', async () => {
    const { teamId, seasonId, venueId } = await seedScope();
    const created = await unitOfWork.runInTransaction(scope =>
      schedules.insert(scope, baseSchedule(teamId, seasonId, venueId)),
    );
    expect(created.weekdays).toEqual([1, 3]);
    expect(created.exceptions).toEqual(['2026-01-12']);
    expect(created.generationStart).toBe('2026-01-05');
    expect(created.defaultCapacity).toBe(24);

    const found = await unitOfWork.runInTransaction(scope =>
      schedules.findByIdInTeam(scope, teamId, created.id),
    );
    expect(found?.timezone).toBe('Africa/Cairo');

    const stale = await unitOfWork.runInTransaction(scope =>
      schedules.update(scope, {
        ...baseSchedule(teamId, seasonId, venueId),
        id: created.id,
        name: 'Renamed',
        status: created.status,
        updatedBy: null,
        expectedVersion: 99,
      }),
    );
    expect(stale).toBeNull();

    const archived = await unitOfWork.runInTransaction(scope =>
      schedules.archive(scope, teamId, created.id, null, NOW),
    );
    expect(archived?.status).toBe('archived');

    const page = await unitOfWork.runInTransaction(scope =>
      schedules.list(scope, teamId, { limit: 20, offset: 0 }),
    );
    expect(page.total).toBe(1);
  });

  it('inserts generated occurrences idempotently and preserves null capacity', async () => {
    const { teamId } = await seedScope();
    const scheduleId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "practice_schedules" ("id", "team_id", "name", "session_type",
              "frequency", "start_time_local", "duration_minutes",
              "generation_start", "generation_until")
       VALUES ($1, $2, 'S', 'practice', 'weekly', '18:00', 90, '2026-01-05', '2026-02-28')`,
      [scheduleId, teamId],
    );

    const first = await unitOfWork.runInTransaction(scope =>
      sessions.insertGenerated(
        scope,
        baseSession(teamId, {
          scheduleId,
          occurrenceDate: '2026-01-05',
          status: SessionStatus.Published,
        }),
      ),
    );
    expect(first?.capacity).toBeNull();
    expect(first?.occurrenceDate).toBe('2026-01-05');

    const duplicate = await unitOfWork.runInTransaction(scope =>
      sessions.insertGenerated(
        scope,
        baseSession(teamId, {
          scheduleId,
          occurrenceDate: '2026-01-05',
          status: SessionStatus.Published,
        }),
      ),
    );
    expect(duplicate).toBeNull();

    const occurrences = await unitOfWork.runInTransaction(scope =>
      sessions.listOccurrenceDates(scope, scheduleId, 1000),
    );
    expect(occurrences).toEqual(['2026-01-05']);

    const bySchedule = await unitOfWork.runInTransaction(scope =>
      sessions.list(scope, teamId, {
        from: null,
        to: null,
        status: null,
        sessionType: null,
        seasonId: null,
        scheduleId,
        limit: 20,
        offset: 0,
      }),
    );
    expect(bySchedule.total).toBe(1);
    expect(bySchedule.items[0]?.scheduleId).toBe(scheduleId);
  });

  it('round-trips a session UTC instant and applies detail/status/reschedule writes', async () => {
    const { teamId, venueId } = await seedScope();
    const created = await unitOfWork.runInTransaction(scope =>
      sessions.insert(scope, baseSession(teamId, { venueId, capacity: 20 })),
    );
    expect(created.startsAt.toISOString()).toBe('2026-01-15T16:00:00.000Z');

    const detailed = await unitOfWork.runInTransaction(scope =>
      sessions.updateDetails(scope, {
        id: created.id,
        teamId,
        venueId,
        field: 'Field B',
        capacity: 30,
        notes: 'Bring bibs',
        visibility: SessionVisibility.Coaches,
        updatedBy: null,
        expectedVersion: created.version,
        now: NOW,
      }),
    );
    expect(detailed?.capacity).toBe(30);

    const published = await unitOfWork.runInTransaction(scope =>
      sessions.applyStatusChange(scope, {
        id: created.id,
        teamId,
        status: SessionStatus.Published,
        cancellationReason: null,
        updatedBy: null,
        expectedVersion: detailed?.version ?? 0,
        now: NOW,
      }),
    );
    expect(published?.status).toBe('published');

    const moved = await unitOfWork.runInTransaction(scope =>
      sessions.reschedule(scope, {
        id: created.id,
        teamId,
        status: SessionStatus.Rescheduled,
        meetAt: null,
        startsAt: new Date('2026-01-16T16:00:00.000Z'),
        endsAt: new Date('2026-01-16T18:00:00.000Z'),
        rsvpCutoffAt: null,
        venueId,
        field: 'Field C',
        updatedBy: null,
        expectedVersion: published?.version ?? 0,
        now: NOW,
      }),
    );
    expect(moved?.startsAt.toISOString()).toBe('2026-01-16T16:00:00.000Z');
    expect(moved?.status).toBe('rescheduled');
  });

  it('appends and reads a session status history', async () => {
    const { teamId } = await seedScope();
    const created = await unitOfWork.runInTransaction(scope =>
      sessions.insert(scope, baseSession(teamId, {})),
    );
    await unitOfWork.runInTransaction(scope =>
      statusEvents.append(scope, {
        id: randomUUID(),
        sessionId: created.id,
        fromStatus: SessionStatus.Draft,
        toStatus: SessionStatus.Published,
        reason: 'ready',
        actorUserId: null,
        now: NOW,
      }),
    );
    const history = await unitOfWork.runInTransaction(scope =>
      statusEvents.listBySession(scope, created.id, 500),
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.toStatus).toBe(SessionStatus.Published);
    expect(history[0]?.fromStatus).toBe(SessionStatus.Draft);
  });

  it('filters the calendar by window, status, and type deterministically', async () => {
    const { teamId } = await seedScope();
    await unitOfWork.runInTransaction(async scope => {
      await sessions.insert(
        scope,
        baseSession(teamId, {
          startsAt: new Date('2026-03-01T16:00:00.000Z'),
          endsAt: new Date('2026-03-01T17:00:00.000Z'),
          status: SessionStatus.Published,
          sessionType: 'fitness',
        }),
      );
      await sessions.insert(
        scope,
        baseSession(teamId, {
          startsAt: new Date('2026-04-01T16:00:00.000Z'),
          endsAt: new Date('2026-04-01T17:00:00.000Z'),
          status: SessionStatus.Draft,
          sessionType: 'practice',
        }),
      );
    });

    const windowed = await unitOfWork.runInTransaction(scope =>
      sessions.list(scope, teamId, {
        from: new Date('2026-03-15T00:00:00.000Z'),
        to: new Date('2026-05-01T00:00:00.000Z'),
        status: null,
        sessionType: null,
        seasonId: null,
        scheduleId: null,
        limit: 20,
        offset: 0,
      }),
    );
    expect(windowed.total).toBe(1);
    expect(windowed.items[0]?.sessionType).toBe('practice');

    const byType = await unitOfWork.runInTransaction(scope =>
      sessions.list(scope, teamId, {
        from: null,
        to: null,
        status: SessionStatus.Published,
        sessionType: 'fitness',
        seasonId: null,
        scheduleId: null,
        limit: 20,
        offset: 0,
      }),
    );
    expect(byType.total).toBe(1);
  });

  it('answers scope existence probes', async () => {
    const { teamId, seasonId, venueId } = await seedScope();
    const result = await unitOfWork.runInTransaction(async scope => ({
      team: await scopes.activeTeamExists(scope, teamId),
      missingTeam: await scopes.activeTeamExists(scope, randomUUID()),
      venue: await scopes.venueExistsInTeam(scope, teamId, venueId),
      season: await scopes.seasonExistsInTeam(scope, teamId, seasonId),
      missingSeason: await scopes.seasonExistsInTeam(
        scope,
        teamId,
        randomUUID(),
      ),
    }));
    expect(result).toEqual({
      team: true,
      missingTeam: false,
      venue: true,
      season: true,
      missingSeason: false,
    });
  });
});
