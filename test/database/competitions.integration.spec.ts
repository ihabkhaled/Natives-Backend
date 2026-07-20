import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import { CompetitionLookupService } from '@modules/competitions/application/competition-lookup.service';
import { CompetitionScopeService } from '@modules/competitions/application/competition-scope.service';
import { CreateCompetitionUseCase } from '@modules/competitions/application/create-competition.use-case';
import { CreateFixtureUseCase } from '@modules/competitions/application/create-fixture.use-case';
import { CreateOpponentUseCase } from '@modules/competitions/application/create-opponent.use-case';
import { FixtureLinkageService } from '@modules/competitions/application/fixture-linkage.service';
import { FixtureLookupService } from '@modules/competitions/application/fixture-lookup.service';
import { RescheduleFixtureUseCase } from '@modules/competitions/application/reschedule-fixture.use-case';
import { TransitionCompetitionUseCase } from '@modules/competitions/application/transition-competition.use-case';
import { CompetitionRepository } from '@modules/competitions/infrastructure/competition.repository';
import { CompetitionScopeRepository } from '@modules/competitions/infrastructure/competition-scope.repository';
import { FixtureRepository } from '@modules/competitions/infrastructure/fixture.repository';
import { OpponentRepository } from '@modules/competitions/infrastructure/opponent.repository';
import { StageRepository } from '@modules/competitions/infrastructure/stage.repository';
import {
  CompetitionTransition,
  CompetitionType,
  MatchSide,
} from '@modules/competitions/model/competitions.enums';
import { AuditRecorderService } from '@modules/platform/application/audit-recorder.service';
import { RecordDomainEventService } from '@modules/platform/application/record-domain-event.service';
import { AuditLogRepository } from '@modules/platform/infrastructure/audit-log.repository';
import { OutboxRepository } from '@modules/platform/infrastructure/outbox.repository';
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

const TEST_DB_CONFIG = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 6,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

const NOW = new Date('2026-01-10T12:00:00.000Z');
const CLOCK = { now: () => NOW, uptime: () => 0 };
const ID_GEN = { generate: () => randomUUID() };

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
  ? 'Competitions integration (PostgreSQL)'
  : `Competitions integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const scopeRepo = new CompetitionScopeRepository();
  const competitionRepo = new CompetitionRepository();
  const stageRepo = new StageRepository();
  const opponentRepo = new OpponentRepository();
  const fixtureRepo = new FixtureRepository();
  const audit = new AuditRecorderService(
    CLOCK,
    ID_GEN,
    new AuditLogRepository(),
  );
  const events = new RecordDomainEventService(
    CLOCK,
    ID_GEN,
    new OutboxRepository(),
  );
  const scopeService = new CompetitionScopeService(scopeRepo);
  const lookup = new CompetitionLookupService(competitionRepo);
  const fixtureLookup = new FixtureLookupService(fixtureRepo);
  const linkage = new FixtureLinkageService(opponentRepo, stageRepo);
  const createCompetition = new CreateCompetitionUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    competitionRepo,
    audit,
    events,
  );
  const transitionCompetition = new TransitionCompetitionUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    competitionRepo,
    audit,
    events,
  );
  const createOpponent = new CreateOpponentUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    opponentRepo,
    audit,
  );
  const createFixture = new CreateFixtureUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    scopeService,
    linkage,
    fixtureRepo,
    audit,
    events,
  );
  const rescheduleFixture = new RescheduleFixtureUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    scopeService,
    fixtureRepo,
    fixtureLookup,
    audit,
    events,
  );

  async function seedActor(): Promise<AuthUserIdentity> {
    const userId = randomUUID();
    await active.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId}@example.test`],
    );
    return { userId, email: `user-${userId}@example.test`, roles: [] };
  }

  async function seedTeamSeason(): Promise<{
    teamId: string;
    seasonId: string;
  }> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    await active.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, 'Natives')`,
      [teamId, `t-${teamId.slice(0, 8)}`],
    );
    await active.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on",
         "ends_on", "status")
       VALUES ($1, $2, $3, 'Season', '2026-01-01', '2026-12-31', 'active')`,
      [seasonId, teamId, `s-${seasonId.slice(0, 8)}`],
    );
    return { teamId, seasonId };
  }

  function competitionContent(seasonId: string, name: string) {
    return {
      name,
      competitionType: CompetitionType.League,
      seasonId,
      genderDivision: null,
      organizerName: null,
      externalRef: null,
      startsOn: '2026-01-01',
      endsOn: '2026-06-01',
      description: null,
    };
  }

  function fixtureContent(opponentId: string) {
    return {
      opponentId,
      stageId: null,
      roundId: null,
      venueId: null,
      homeAway: MatchSide.Home,
      scheduledAt: '2026-02-15T18:30:00.000Z',
    };
  }

  async function eventCount(
    aggregateId: string,
    eventType: string,
  ): Promise<number> {
    const rows: { count: number }[] = await active.query(
      `SELECT COUNT(*)::int AS "count" FROM "outbox_events"
        WHERE "aggregate_id" = $1 AND "event_type" = $2`,
      [aggregateId, eventType],
    );
    return rows[0]?.count ?? 0;
  }

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await active.undoLastMigration();
      remaining -= 1;
    }
    await active.destroy();
  });

  it('proves the schema migrates from empty and creates the tables', async () => {
    const rows: { relation: string | null }[] = await active.query(
      `SELECT to_regclass('public.competitions') AS relation`,
    );
    expect(rows[0]?.relation).toBe('competitions');
  });

  it('creates a draft competition and records a created event atomically', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const competition = await createCompetition.execute(actor, teamId, {
      content: competitionContent(seasonId, 'Winter League'),
    });
    expect(competition.status).toBe('draft');
    expect(
      await eventCount(competition.competitionId, 'competition.created.v1'),
    ).toBe(1);
  });

  it('emits competition.published when a draft is published', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const competition = await createCompetition.execute(actor, teamId, {
      content: competitionContent(seasonId, 'Spring League'),
    });
    const published = await transitionCompetition.execute(
      actor,
      teamId,
      competition.competitionId,
      {
        transition: CompetitionTransition.Publish,
        expectedRecordVersion: competition.recordVersion,
        reason: null,
      },
    );
    expect(published.status).toBe('published');
    expect(
      await eventCount(competition.competitionId, 'competition.published.v1'),
    ).toBe(1);
  });

  it('enforces one competition name per team and season', async () => {
    const { teamId, seasonId } = await seedTeamSeason();
    const insert = (id: string): Promise<unknown> =>
      active.query(
        `INSERT INTO "competitions"
          ("id", "team_id", "season_id", "name", "competition_type")
         VALUES ($1, $2, $3, 'Cup', 'championship')`,
        [id, teamId, seasonId],
      );
    await insert(randomUUID());
    await expect(insert(randomUUID())).rejects.toThrow();
  });

  it('reschedules a fixture, retaining the previous instant and emitting the event', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const competition = await createCompetition.execute(actor, teamId, {
      content: competitionContent(seasonId, 'Fixture League'),
    });
    const opponent = await createOpponent.execute(actor, teamId, {
      content: {
        name: 'Sharks',
        shortName: null,
        logoRef: null,
        contactName: null,
        contactInfo: null,
        notes: null,
      },
    });
    const fixture = await createFixture.execute(
      actor,
      teamId,
      competition.competitionId,
      { content: fixtureContent(opponent.opponentId) },
    );
    expect(await eventCount(fixture.fixtureId, 'fixture.scheduled.v1')).toBe(1);
    const moved = await rescheduleFixture.execute(
      actor,
      teamId,
      competition.competitionId,
      fixture.fixtureId,
      {
        scheduledAt: '2026-03-01T18:30:00.000Z',
        venueId: null,
        reason: 'weather',
        expectedRecordVersion: fixture.recordVersion,
      },
    );
    expect(moved.status).toBe('rescheduled');
    expect(moved.rescheduleCount).toBe(1);
    expect(moved.previousScheduledAt?.toISOString()).toBe(
      fixture.scheduledAt.toISOString(),
    );
    expect(await eventCount(fixture.fixtureId, 'fixture.rescheduled.v1')).toBe(
      1,
    );
  });

  it('keeps historical fixtures when a competition is cancelled', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const competition = await createCompetition.execute(actor, teamId, {
      content: competitionContent(seasonId, 'Cancelled League'),
    });
    const opponent = await createOpponent.execute(actor, teamId, {
      content: {
        name: 'Falcons',
        shortName: null,
        logoRef: null,
        contactName: null,
        contactInfo: null,
        notes: null,
      },
    });
    const fixture = await createFixture.execute(
      actor,
      teamId,
      competition.competitionId,
      { content: fixtureContent(opponent.opponentId) },
    );
    await transitionCompetition.execute(
      actor,
      teamId,
      competition.competitionId,
      {
        transition: CompetitionTransition.Cancel,
        expectedRecordVersion: competition.recordVersion,
        reason: 'season abandoned',
      },
    );
    const rows: { count: number }[] = await active.query(
      `SELECT COUNT(*)::int AS "count" FROM "fixtures" WHERE "id" = $1`,
      [fixture.fixtureId],
    );
    expect(rows[0]?.count).toBe(1);
  });

  it('rolls the whole transaction back when the version guard misses', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const competition = await createCompetition.execute(actor, teamId, {
      content: competitionContent(seasonId, 'Guarded League'),
    });
    await expect(
      transitionCompetition.execute(actor, teamId, competition.competitionId, {
        transition: CompetitionTransition.Publish,
        expectedRecordVersion: competition.recordVersion + 99,
        reason: null,
      }),
    ).rejects.toThrow();
    expect(
      await eventCount(competition.competitionId, 'competition.published.v1'),
    ).toBe(0);
  });

  it('restricts deleting an opponent that a fixture references', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const competition = await createCompetition.execute(actor, teamId, {
      content: competitionContent(seasonId, 'Restrict League'),
    });
    const opponent = await createOpponent.execute(actor, teamId, {
      content: {
        name: 'Titans',
        shortName: null,
        logoRef: null,
        contactName: null,
        contactInfo: null,
        notes: null,
      },
    });
    await createFixture.execute(actor, teamId, competition.competitionId, {
      content: fixtureContent(opponent.opponentId),
    });
    await expect(
      active.query(`DELETE FROM "opponents" WHERE "id" = $1`, [
        opponent.opponentId,
      ]),
    ).rejects.toThrow();
  });
});
