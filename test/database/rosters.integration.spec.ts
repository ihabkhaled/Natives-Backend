import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import { AuditRecorderService } from '@modules/platform/application/audit-recorder.service';
import { RecordDomainEventService } from '@modules/platform/application/record-domain-event.service';
import { AuditLogRepository } from '@modules/platform/infrastructure/audit-log.repository';
import { OutboxRepository } from '@modules/platform/infrastructure/outbox.repository';
import { AddRosterEntryUseCase } from '@modules/rosters/application/add-roster-entry.use-case';
import { CreateCompetitionRosterUseCase } from '@modules/rosters/application/create-competition-roster.use-case';
import { CreateMatchRosterUseCase } from '@modules/rosters/application/create-match-roster.use-case';
import { DeclareRosterAvailabilityUseCase } from '@modules/rosters/application/declare-roster-availability.use-case';
import { LockRosterUseCase } from '@modules/rosters/application/lock-roster.use-case';
import { RemoveRosterEntryUseCase } from '@modules/rosters/application/remove-roster-entry.use-case';
import { ReviseRosterUseCase } from '@modules/rosters/application/revise-roster.use-case';
import { RosterAvailabilityQueryService } from '@modules/rosters/application/roster-availability-query.service';
import { RosterEntryQueryService } from '@modules/rosters/application/roster-entry-query.service';
import { RosterLookupService } from '@modules/rosters/application/roster-lookup.service';
import { RosterQueryService } from '@modules/rosters/application/roster-query.service';
import { RosterScopeService } from '@modules/rosters/application/roster-scope.service';
import { RosterSnapshotQueryService } from '@modules/rosters/application/roster-snapshot-query.service';
import { RosterSnapshotRecorderService } from '@modules/rosters/application/roster-snapshot-recorder.service';
import { RosterValidationService } from '@modules/rosters/application/roster-validation.service';
import { TransitionRosterUseCase } from '@modules/rosters/application/transition-roster.use-case';
import { RosterRepository } from '@modules/rosters/infrastructure/roster.repository';
import { RosterAvailabilityRepository } from '@modules/rosters/infrastructure/roster-availability.repository';
import { RosterEntryRepository } from '@modules/rosters/infrastructure/roster-entry.repository';
import { RosterScopeRepository } from '@modules/rosters/infrastructure/roster-scope.repository';
import { RosterSnapshotRepository } from '@modules/rosters/infrastructure/roster-snapshot.repository';
import { RosterSourceRepository } from '@modules/rosters/infrastructure/roster-source.repository';
import {
  ConstraintCode,
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
  RosterTransition,
  SnapshotReason,
} from '@modules/rosters/model/rosters.enums';
import type {
  CompetitionRosterContent,
  RosterEntryContent,
} from '@modules/rosters/model/rosters.types';
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
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';

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

const NOW = new Date('2026-03-01T09:00:00.000Z');
const CLOCK = { now: () => NOW, uptime: () => 0 };
const ID_GEN = { generate: () => randomUUID() };
const PAGE = { limit: 50, offset: 0 };

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
  ? 'Rosters integration (PostgreSQL)'
  : `Rosters integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const scopeRepo = new RosterScopeRepository();
  const rosterRepo = new RosterRepository();
  const entryRepo = new RosterEntryRepository();
  const availabilityRepo = new RosterAvailabilityRepository();
  const snapshotRepo = new RosterSnapshotRepository();
  const sourceRepo = new RosterSourceRepository();
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
  const scopeService = new RosterScopeService(scopeRepo);
  const lookup = new RosterLookupService(rosterRepo);
  const validation = new RosterValidationService(unitOfWork, lookup, entryRepo);
  const snapshots = new RosterSnapshotRecorderService(
    CLOCK,
    ID_GEN,
    rosterRepo,
    entryRepo,
    snapshotRepo,
    audit,
  );
  const createRoster = new CreateCompetitionRosterUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    rosterRepo,
    entryRepo,
    sourceRepo,
    audit,
    events,
  );
  const createMatchRoster = new CreateMatchRosterUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    lookup,
    rosterRepo,
    entryRepo,
    audit,
    events,
  );
  const addEntry = new AddRosterEntryUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    sourceRepo,
    entryRepo,
    audit,
  );
  const removeEntry = new RemoveRosterEntryUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    entryRepo,
    audit,
  );
  const declareAvailability = new DeclareRosterAvailabilityUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    sourceRepo,
    availabilityRepo,
    audit,
  );
  const transitionRoster = new TransitionRosterUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    rosterRepo,
    entryRepo,
    sourceRepo,
    validation,
    snapshots,
    audit,
    events,
  );
  const lockRoster = new LockRosterUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    rosterRepo,
    validation,
    snapshots,
    audit,
    events,
  );
  const reviseRoster = new ReviseRosterUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    rosterRepo,
    entryRepo,
    snapshots,
    audit,
    events,
  );
  const rosterQuery = new RosterQueryService(unitOfWork, rosterRepo, lookup);
  const entryQuery = new RosterEntryQueryService(unitOfWork, lookup, entryRepo);
  const availabilityQuery = new RosterAvailabilityQueryService(
    unitOfWork,
    lookup,
    availabilityRepo,
  );
  const snapshotQuery = new RosterSnapshotQueryService(
    unitOfWork,
    lookup,
    snapshotRepo,
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

  async function seedScope(): Promise<{
    teamId: string;
    seasonId: string;
    competitionId: string;
  }> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const competitionId = randomUUID();
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
    await active.query(
      `INSERT INTO "competitions" ("id", "team_id", "season_id", "name",
         "competition_type", "status")
       VALUES ($1, $2, $3, 'Nationals', 'championship', 'published')`,
      [competitionId, teamId, seasonId],
    );
    return { teamId, seasonId, competitionId };
  }

  async function seedFixture(
    teamId: string,
    seasonId: string,
    competitionId: string,
  ): Promise<string> {
    const opponentId = randomUUID();
    const fixtureId = randomUUID();
    await active.query(
      `INSERT INTO "opponents" ("id", "team_id", "name") VALUES ($1, $2, $3)`,
      [opponentId, teamId, `Opponent ${opponentId.slice(0, 6)}`],
    );
    await active.query(
      `INSERT INTO "fixtures" ("id", "competition_id", "team_id", "season_id",
         "opponent_id", "home_away", "scheduled_at")
       VALUES ($1, $2, $3, $4, $5, 'home', '2026-05-01T09:00:00.000Z')`,
      [fixtureId, competitionId, teamId, seasonId, opponentId],
    );
    return fixtureId;
  }

  async function seedMember(
    teamId: string,
    seasonId: string,
    options: {
      readonly status?: string;
      readonly jerseyNumber?: number | null;
      readonly gender?: string | null;
      readonly userId?: string | null;
    } = {},
  ): Promise<string> {
    const membershipId = randomUUID();
    await active.query(
      `INSERT INTO "memberships" ("id", "team_id", "season_id", "user_id",
         "status")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        membershipId,
        teamId,
        seasonId,
        options.userId ?? null,
        options.status ?? 'active',
      ],
    );
    await active.query(
      `INSERT INTO "member_profiles" ("id", "membership_id", "team_id",
         "full_name", "gender", "jersey_number")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        membershipId,
        teamId,
        `Player ${membershipId.slice(0, 6)}`,
        options.gender ?? 'woman',
        options.jerseyNumber === undefined ? null : options.jerseyNumber,
      ],
    );
    return membershipId;
  }

  async function seedSquad(
    teamId: string,
    seasonId: string,
    competitionId: string,
  ): Promise<string> {
    const squadId = randomUUID();
    await active.query(
      `INSERT INTO "squads" ("id", "team_id", "season_id", "competition_id",
         "name")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        squadId,
        teamId,
        seasonId,
        competitionId,
        `Squad ${squadId.slice(0, 8)}`,
      ],
    );
    return squadId;
  }

  async function selectIntoSquad(
    squadId: string,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    await active.query(
      `INSERT INTO "squad_selections" ("id", "squad_id", "team_id",
         "membership_id", "eligibility_snapshot")
       VALUES ($1, $2, $3, $4, 'passed')`,
      [randomUUID(), squadId, teamId, membershipId],
    );
  }

  function rosterContent(
    competitionId: string,
    name: string,
    overrides: Partial<CompetitionRosterContent> = {},
  ): CompetitionRosterContent {
    return {
      competitionId,
      squadId: null,
      name,
      division: RosterDivision.Mixed,
      minSize: 1,
      maxSize: 30,
      minWomen: null,
      requireCaptain: false,
      selectionDeadline: null,
      notes: null,
      ...overrides,
    };
  }

  function entryContent(
    membershipId: string,
    overrides: Partial<RosterEntryContent> = {},
  ): RosterEntryContent {
    return {
      membershipId,
      jerseyNumber: null,
      entryRole: RosterEntryRole.Player,
      lineAssignment: RosterLine.Any,
      fieldPosition: RosterPosition.Unspecified,
      selectionReason: null,
      ...overrides,
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

  async function auditCount(
    resourceId: string,
    action: string,
  ): Promise<number> {
    const rows: { count: number }[] = await active.query(
      `SELECT COUNT(*)::int AS "count" FROM "audit_log"
        WHERE "resource_id" = $1 AND "action" = $2`,
      [resourceId, action],
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

  it('proves the schema migrates from empty and creates every roster table', async () => {
    const rows: { relation: string | null }[] = await active.query(
      `SELECT to_regclass('public.rosters') AS relation
       UNION ALL SELECT to_regclass('public.roster_entries')
       UNION ALL SELECT to_regclass('public.roster_availability')
       UNION ALL SELECT to_regclass('public.roster_snapshots')`,
    );
    expect(rows.map(row => row.relation)).toEqual([
      'rosters',
      'roster_entries',
      'roster_availability',
      'roster_snapshots',
    ]);
  });

  it('creates a draft competition roster and records the created event atomically', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Nationals Roster'),
    });
    expect(roster.status).toBe(RosterStatus.Draft);
    expect(roster.rosterKind).toBe(RosterKind.Competition);
    expect(roster.revision).toBe(1);
    expect(roster.policyVersion).toBe('roster-constraints-v1');
    expect(roster.minWomen).toBeNull();
    expect(await eventCount(roster.rosterId, 'roster.created.v1')).toBe(1);
    expect(await auditCount(roster.rosterId, 'roster.created')).toBe(1);
  });

  it('generates a roster from the season squad as a point-in-time copy', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const squadId = await seedSquad(
      scope.teamId,
      scope.seasonId,
      scope.competitionId,
    );
    const first = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    const second = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 8,
      gender: 'man',
    });
    await seedMember(scope.teamId, scope.seasonId, { jerseyNumber: 9 });
    await selectIntoSquad(squadId, scope.teamId, first);
    await selectIntoSquad(squadId, scope.teamId, second);
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Generated Roster', {
        squadId,
      }),
    });
    const page = await entryQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(page.total).toBe(2);
    expect(page.items.map(item => item.membershipId).sort()).toEqual(
      [first, second].sort(),
    );
  });

  it('allows only one live roster per competition', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'First'),
    });
    await expect(
      createRoster.execute(actor, scope.teamId, {
        content: rosterContent(scope.competitionId, 'Second'),
      }),
    ).rejects.toThrow();
  });

  it('hides a competition from another team behind a not-found scope', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const other = await seedScope();
    await expect(
      createRoster.execute(actor, other.teamId, {
        content: rosterContent(scope.competitionId, 'Cross Team Roster'),
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.scopeNotFound' });
  });

  it('rejects a jersey another selected player already wears', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Jersey Roster'),
    });
    const first = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    const second = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: null,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(first),
      override: null,
    });
    await expect(
      addEntry.execute(actor, scope.teamId, roster.rosterId, {
        content: entryContent(second, { jerseyNumber: 7 }),
        override: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.jerseyConflict' });
  });

  it('allows at most one captain and one spirit captain per roster', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Captain Roster'),
    });
    const first = await seedMember(scope.teamId, scope.seasonId);
    const second = await seedMember(scope.teamId, scope.seasonId);
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(first, { entryRole: RosterEntryRole.Captain }),
      override: null,
    });
    await expect(
      addEntry.execute(actor, scope.teamId, roster.rosterId, {
        content: entryContent(second, { entryRole: RosterEntryRole.Captain }),
        override: null,
      }),
    ).rejects.toThrow();
  });

  it('refuses a suspended player without an override and records one with it', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Override Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      status: 'suspended',
    });
    await expect(
      addEntry.execute(actor, scope.teamId, roster.rosterId, {
        content: entryContent(membershipId),
        override: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.overrideRequired' });
    const entry = await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: { overrideReason: 'disciplinary review closed' },
    });
    expect(entry.constraintOverridden).toBe(true);
    expect(entry.overrideReason).toBe('disciplinary review closed');
    expect(entry.overriddenBy).toBe(actor.userId);
    expect(await auditCount(membershipId, 'roster.entry.overridden')).toBe(1);
  });

  it('rejects an overridden entry that carries no reason at the database level', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Check Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId);
    await expect(
      active.query(
        `INSERT INTO "roster_entries" ("id", "roster_id", "team_id",
           "membership_id", "constraint_overridden")
         VALUES ($1, $2, $3, $4, true)`,
        [randomUUID(), roster.rosterId, scope.teamId, membershipId],
      ),
    ).rejects.toThrow();
  });

  it('blocks publishing a roster that breaks a composition rule', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Undersized Roster', {
        minSize: 7,
      }),
    });
    const report = await validation.preview(scope.teamId, roster.rosterId);
    expect(report.publishable).toBe(false);
    expect(report.violations[0]?.code).toBe(ConstraintCode.MinSize);
    await expect(
      transitionRoster.execute(actor, scope.teamId, roster.rosterId, {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.rosterConstraint' });
    expect(await eventCount(roster.rosterId, 'roster.published.v1')).toBe(0);
  });

  it('publishes a roster, freezing a snapshot and enqueuing the notify signal', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Publish Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    await seedMember(scope.teamId, scope.seasonId, { jerseyNumber: 8 });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: null,
    });
    const published = await transitionRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion,
      },
    );
    expect(published.status).toBe(RosterStatus.Published);
    expect(published.publishedAt?.toISOString()).toBe(NOW.toISOString());
    expect(published.currentSnapshotId).not.toBeNull();
    const rows: {
      payload: {
        audience: string;
        selectedCount: number;
        notSelectedCount: number;
      };
    }[] = await active.query(
      `SELECT "payload" FROM "outbox_events"
        WHERE "aggregate_id" = $1 AND "event_type" = 'roster.published.v1'`,
      [roster.rosterId],
    );
    expect(rows[0]?.payload.audience).toBe('selected_and_not_selected');
    expect(rows[0]?.payload.selectedCount).toBe(1);
    expect(rows[0]?.payload.notSelectedCount).toBe(1);
  });

  it('rolls the whole publish transaction back when the version guard misses', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Guarded Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: null,
    });
    await expect(
      transitionRoster.execute(actor, scope.teamId, roster.rosterId, {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion + 99,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.rosters.rosterVersionConflict',
    });
    expect(await eventCount(roster.rosterId, 'roster.published.v1')).toBe(0);
    const reloaded = await rosterQuery.getById(scope.teamId, roster.rosterId);
    expect(reloaded.status).toBe(RosterStatus.Draft);
    expect(reloaded.currentSnapshotId).toBeNull();
  });

  it('locks a roster, freezes it, and refuses any further entry change', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Locked Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: null,
    });
    const published = await transitionRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion,
      },
    );
    const locked = await lockRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      { expectedRecordVersion: published.recordVersion },
    );
    expect(locked.status).toBe(RosterStatus.Locked);
    expect(locked.lockedAt?.toISOString()).toBe(NOW.toISOString());
    expect(await eventCount(roster.rosterId, 'roster.locked.v1')).toBe(1);
    await expect(
      addEntry.execute(actor, scope.teamId, roster.rosterId, {
        content: entryContent(membershipId),
        override: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.rosterLocked' });
    await expect(
      removeEntry.execute(actor, scope.teamId, roster.rosterId, {
        membershipId,
        reason: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.rosterLocked' });
  });

  it('keeps a locked roster and its snapshot intact when the squad later changes', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const squadId = await seedSquad(
      scope.teamId,
      scope.seasonId,
      scope.competitionId,
    );
    const staying = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    const dropped = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 8,
    });
    await selectIntoSquad(squadId, scope.teamId, staying);
    await selectIntoSquad(squadId, scope.teamId, dropped);
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'History Roster', {
        squadId,
      }),
    });
    const published = await transitionRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion,
      },
    );
    const locked = await lockRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      { expectedRecordVersion: published.recordVersion },
    );
    const before = await snapshotQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    const lockedSnapshot = before.items.find(
      item => item.reason === SnapshotReason.Locked,
    );
    expect(lockedSnapshot?.entryCount).toBe(2);

    // The squad changes AFTER the lock: a player is removed and another added.
    await active.query(
      `UPDATE "squad_selections" SET "status" = 'removed'
        WHERE "squad_id" = $1 AND "membership_id" = $2`,
      [squadId, dropped],
    );
    const latecomer = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 9,
    });
    await selectIntoSquad(squadId, scope.teamId, latecomer);

    const after = await snapshotQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    const reloadedSnapshot = after.items.find(
      item => item.snapshotId === lockedSnapshot?.snapshotId,
    );
    expect(reloadedSnapshot?.entryCount).toBe(2);
    expect(reloadedSnapshot?.checksum).toBe(lockedSnapshot?.checksum);
    expect(
      reloadedSnapshot?.entries.map(item => item.membershipId).sort(),
    ).toEqual([staying, dropped].sort());
    const entries = await entryQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(entries.total).toBe(2);
    expect(locked.revision).toBe(1);
  });

  it('refuses to rewrite an existing snapshot, in the app and in the database', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Immutable Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: null,
    });
    const published = await transitionRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion,
      },
    );
    const page = await snapshotQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    const snapshot = page.items[0];
    expect(snapshot?.reason).toBe(SnapshotReason.Published);
    await active.query(
      `UPDATE "roster_snapshots" SET "entry_count" = 999, "checksum" = 'tampered'
        WHERE "id" = $1`,
      [snapshot?.snapshotId],
    );
    const rows: { entry_count: number; checksum: string }[] =
      await active.query(
        `SELECT "entry_count", "checksum" FROM "roster_snapshots"
          WHERE "id" = $1`,
        [snapshot?.snapshotId],
      );
    expect(rows[0]?.entry_count).toBe(1);
    expect(rows[0]?.checksum).toBe(snapshot?.checksum);
    expect(published.currentSnapshotId).toBe(snapshot?.snapshotId);
  });

  it('supersedes a locked roster with a revision that starts from the snapshot', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Revision Roster'),
    });
    const first = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    const second = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 8,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(first),
      override: null,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(second),
      override: null,
    });
    const published = await transitionRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      {
        transition: RosterTransition.Publish,
        expectedRecordVersion: roster.recordVersion,
      },
    );
    const locked = await lockRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      { expectedRecordVersion: published.recordVersion },
    );
    const successor = await reviseRoster.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      {
        reason: 'injury replacement',
        expectedRecordVersion: locked.recordVersion,
      },
    );
    expect(successor.rosterId).not.toBe(roster.rosterId);
    expect(successor.status).toBe(RosterStatus.Draft);
    expect(successor.revision).toBe(2);
    expect(successor.supersedesRosterId).toBe(roster.rosterId);
    const superseded = await rosterQuery.getById(scope.teamId, roster.rosterId);
    expect(superseded.status).toBe(RosterStatus.Revised);
    expect(superseded.revisionReason).toBe('injury replacement');
    const carried = await entryQuery.listForRoster(
      scope.teamId,
      successor.rosterId,
      PAGE,
    );
    expect(carried.total).toBe(2);
    const originalEntries = await entryQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(originalEntries.total).toBe(2);
    await removeEntry.execute(actor, scope.teamId, successor.rosterId, {
      membershipId: second,
      reason: 'injured',
    });
    const afterEdit = await entryQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(
      afterEdit.items.filter(
        item => item.status === RosterEntryStatus.Selected,
      ),
    ).toHaveLength(2);
    expect(await eventCount(roster.rosterId, 'roster.revised.v1')).toBe(1);
  });

  it('refuses to revise a draft roster', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Draft Roster'),
    });
    await expect(
      reviseRoster.execute(actor, scope.teamId, roster.rosterId, {
        reason: 'too early',
        expectedRecordVersion: roster.recordVersion,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.rosters.rosterInvalidTransition',
    });
  });

  it('keeps a withdrawn player in the roster export with zero contribution', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Export Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: null,
    });
    const removed = await removeEntry.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      { membershipId, reason: 'travelling' },
    );
    expect(removed.status).toBe(RosterEntryStatus.Withdrawn);
    expect(removed.removalReason).toBe('travelling');
    const page = await entryQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(page.total).toBe(1);
    expect(page.items[0]?.status).toBe(RosterEntryStatus.Withdrawn);
    await expect(
      removeEntry.execute(actor, scope.teamId, roster.rosterId, {
        membershipId,
        reason: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.entryNotFound' });
  });

  it('creates a match roster copied from the competition roster and independent of it', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const fixtureId = await seedFixture(
      scope.teamId,
      scope.seasonId,
      scope.competitionId,
    );
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Source Roster'),
    });
    const first = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 7,
    });
    const second = await seedMember(scope.teamId, scope.seasonId, {
      jerseyNumber: 8,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(first),
      override: null,
    });
    await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(second),
      override: null,
    });
    const matchRoster = await createMatchRoster.execute(actor, scope.teamId, {
      content: {
        fixtureId,
        sourceRosterId: roster.rosterId,
        name: 'Game 1',
        division: RosterDivision.Mixed,
        minSize: 1,
        maxSize: 30,
        minWomen: null,
        requireCaptain: false,
        notes: null,
      },
    });
    expect(matchRoster.rosterKind).toBe(RosterKind.Match);
    expect(matchRoster.fixtureId).toBe(fixtureId);
    expect(matchRoster.seasonId).toBe(scope.seasonId);
    const copied = await entryQuery.listForRoster(
      scope.teamId,
      matchRoster.rosterId,
      PAGE,
    );
    expect(copied.total).toBe(2);
    await removeEntry.execute(actor, scope.teamId, matchRoster.rosterId, {
      membershipId: second,
      reason: 'rested',
    });
    const sourceEntries = await entryQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(
      sourceEntries.items.filter(
        item => item.status === RosterEntryStatus.Selected,
      ),
    ).toHaveLength(2);
  });

  it('lets a member declare availability once, resolved from their identity', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Availability Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      userId: actor.userId,
    });
    const first = await declareAvailability.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      { availability: RosterAvailabilityStatus.Tentative, reason: 'exams' },
    );
    expect(first.membershipId).toBe(membershipId);
    expect(first.source).toBe('self');
    const second = await declareAvailability.execute(
      actor,
      scope.teamId,
      roster.rosterId,
      { availability: RosterAvailabilityStatus.Unavailable, reason: null },
    );
    expect(second.availabilityId).toBe(first.availabilityId);
    expect(second.recordVersion).toBe(first.recordVersion + 1);
    const page = await availabilityQuery.listForRoster(
      scope.teamId,
      roster.rosterId,
      PAGE,
    );
    expect(page.total).toBe(1);
  });

  it('freezes the declared availability onto the entry and flags a "not going" pick', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Unavailable Roster'),
    });
    const membershipId = await seedMember(scope.teamId, scope.seasonId, {
      userId: actor.userId,
      jerseyNumber: 7,
    });
    await declareAvailability.execute(actor, scope.teamId, roster.rosterId, {
      availability: RosterAvailabilityStatus.Unavailable,
      reason: null,
    });
    await expect(
      addEntry.execute(actor, scope.teamId, roster.rosterId, {
        content: entryContent(membershipId),
        override: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.overrideRequired' });
    const entry = await addEntry.execute(actor, scope.teamId, roster.rosterId, {
      content: entryContent(membershipId),
      override: { overrideReason: 'confirmed by phone' },
    });
    expect(entry.availability).toBe(RosterAvailabilityStatus.Unavailable);
    const report = await validation.preview(scope.teamId, roster.rosterId);
    expect(report.composition.unavailableSelected).toBe(1);
  });

  it('refuses an availability declaration from a principal with no membership', async () => {
    const actor = await seedActor();
    const stranger = await seedActor();
    const scope = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Stranger Roster'),
    });
    await expect(
      declareAvailability.execute(stranger, scope.teamId, roster.rosterId, {
        availability: RosterAvailabilityStatus.Available,
        reason: null,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.rosters.availabilityMembershipNotFound',
    });
  });

  it('hides another team’s roster behind a not-found lookup', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const other = await seedScope();
    const roster = await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Hidden Roster'),
    });
    await expect(
      rosterQuery.getById(other.teamId, roster.rosterId),
    ).rejects.toMatchObject({ messageKey: 'errors.rosters.rosterNotFound' });
  });

  it('lists rosters under the allow-listed filters only', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const fixtureId = await seedFixture(
      scope.teamId,
      scope.seasonId,
      scope.competitionId,
    );
    await createRoster.execute(actor, scope.teamId, {
      content: rosterContent(scope.competitionId, 'Listed Roster'),
    });
    await createMatchRoster.execute(actor, scope.teamId, {
      content: {
        fixtureId,
        sourceRosterId: null,
        name: 'Game 1',
        division: RosterDivision.Mixed,
        minSize: 1,
        maxSize: 30,
        minWomen: null,
        requireCaptain: false,
        notes: null,
      },
    });
    const all = await rosterQuery.listForScope(
      scope.teamId,
      { competitionId: null, fixtureId: null, rosterKind: null },
      PAGE,
    );
    expect(all.total).toBe(2);
    const matchOnly = await rosterQuery.listForScope(
      scope.teamId,
      { competitionId: null, fixtureId: null, rosterKind: RosterKind.Match },
      PAGE,
    );
    expect(matchOnly.total).toBe(1);
    expect(matchOnly.items[0]?.fixtureId).toBe(fixtureId);
  });
});
