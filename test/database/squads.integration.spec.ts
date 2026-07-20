import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import { AuditRecorderService } from '@modules/platform/application/audit-recorder.service';
import { RecordDomainEventService } from '@modules/platform/application/record-domain-event.service';
import { AuditLogRepository } from '@modules/platform/infrastructure/audit-log.repository';
import { OutboxRepository } from '@modules/platform/infrastructure/outbox.repository';
import { AvailabilityQueryService } from '@modules/squads/application/availability-query.service';
import { CreateSquadUseCase } from '@modules/squads/application/create-squad.use-case';
import { DeclareAvailabilityUseCase } from '@modules/squads/application/declare-availability.use-case';
import { EligibilityReportService } from '@modules/squads/application/eligibility-report.service';
import { RemoveSelectionUseCase } from '@modules/squads/application/remove-selection.use-case';
import { SelectPlayerUseCase } from '@modules/squads/application/select-player.use-case';
import { SelectionQueryService } from '@modules/squads/application/selection-query.service';
import { SquadLookupService } from '@modules/squads/application/squad-lookup.service';
import { SquadQueryService } from '@modules/squads/application/squad-query.service';
import { SquadScopeService } from '@modules/squads/application/squad-scope.service';
import { TransitionSquadUseCase } from '@modules/squads/application/transition-squad.use-case';
import { SquadRepository } from '@modules/squads/infrastructure/squad.repository';
import { SquadAvailabilityRepository } from '@modules/squads/infrastructure/squad-availability.repository';
import { SquadEligibilityRepository } from '@modules/squads/infrastructure/squad-eligibility.repository';
import { SquadScopeRepository } from '@modules/squads/infrastructure/squad-scope.repository';
import { SquadSelectionRepository } from '@modules/squads/infrastructure/squad-selection.repository';
import {
  AvailabilityStatus,
  SelectionRole,
  SignalCode,
  SignalStatus,
  SquadTransition,
} from '@modules/squads/model/squads.enums';
import type { SquadContent } from '@modules/squads/model/squads.types';
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

const NOW = new Date('2026-02-01T09:00:00.000Z');
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
  ? 'Squads integration (PostgreSQL)'
  : `Squads integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const scopeRepo = new SquadScopeRepository();
  const squadRepo = new SquadRepository();
  const selectionRepo = new SquadSelectionRepository();
  const availabilityRepo = new SquadAvailabilityRepository();
  const eligibilityRepo = new SquadEligibilityRepository();
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
  const scopeService = new SquadScopeService(scopeRepo);
  const lookup = new SquadLookupService(squadRepo);
  const createSquad = new CreateSquadUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    squadRepo,
    audit,
    events,
  );
  const transitionSquad = new TransitionSquadUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    squadRepo,
    selectionRepo,
    audit,
    events,
  );
  const selectPlayer = new SelectPlayerUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    eligibilityRepo,
    selectionRepo,
    audit,
  );
  const removeSelection = new RemoveSelectionUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    selectionRepo,
    audit,
  );
  const declareAvailability = new DeclareAvailabilityUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    eligibilityRepo,
    availabilityRepo,
    audit,
  );
  const eligibilityReport = new EligibilityReportService(
    unitOfWork,
    lookup,
    eligibilityRepo,
  );
  const squadQuery = new SquadQueryService(unitOfWork, squadRepo, lookup);
  const selectionQuery = new SelectionQueryService(
    unitOfWork,
    lookup,
    selectionRepo,
  );
  const availabilityQuery = new AvailabilityQueryService(
    unitOfWork,
    lookup,
    availabilityRepo,
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

  async function seedMember(
    teamId: string,
    seasonId: string | null,
    options: {
      readonly status?: string;
      readonly jerseyNumber?: number | null;
      readonly gender?: string | null;
      readonly userId?: string | null;
      readonly fullName?: string;
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
        options.fullName ?? `Player ${membershipId.slice(0, 6)}`,
        options.gender ?? null,
        options.jerseyNumber === undefined ? 7 : options.jerseyNumber,
      ],
    );
    return membershipId;
  }

  async function seedSession(
    teamId: string,
    seasonId: string,
  ): Promise<{ sessionId: string; sheetId: string }> {
    const sessionId = randomUUID();
    const sheetId = randomUUID();
    await active.query(
      `INSERT INTO "practice_sessions" ("id", "team_id", "season_id",
         "session_type", "starts_at", "ends_at", "status")
       VALUES ($1, $2, $3, 'practice', '2026-01-05T17:00:00.000Z',
               '2026-01-05T19:00:00.000Z', 'completed')`,
      [sessionId, teamId, seasonId],
    );
    await active.query(
      `INSERT INTO "attendance_sheets" ("id", "session_id", "team_id",
         "season_id", "state")
       VALUES ($1, $2, $3, $4, 'finalized')`,
      [sheetId, sessionId, teamId, seasonId],
    );
    return { sessionId, sheetId };
  }

  async function seedAttendance(
    sheet: { sessionId: string; sheetId: string },
    teamId: string,
    seasonId: string,
    membershipId: string,
    status: string,
  ): Promise<void> {
    await active.query(
      `INSERT INTO "attendance_records" ("id", "sheet_id", "session_id",
         "team_id", "season_id", "membership_id", "status")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        sheet.sheetId,
        sheet.sessionId,
        teamId,
        seasonId,
        membershipId,
        status,
      ],
    );
  }

  function squadContent(
    seasonId: string,
    name: string,
    attendanceThresholdPct = 70,
  ): SquadContent {
    return {
      name,
      seasonId,
      competitionId: null,
      attendanceThresholdPct,
      selectionDeadline: null,
      notes: null,
    };
  }

  function selectionContent(membershipId: string) {
    return {
      membershipId,
      selectionRole: SelectionRole.Player,
      reason: null,
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

  /** A candidate with a jersey, an active membership, and declared availability. */
  async function seedClearCandidate(
    teamId: string,
    seasonId: string,
    squadId: string,
    gender: string | null = 'man',
  ): Promise<string> {
    const membershipId = await seedMember(teamId, seasonId, {
      jerseyNumber: 11,
      gender,
    });
    await active.query(
      `INSERT INTO "squad_availability" ("id", "squad_id", "team_id",
         "membership_id", "availability", "source")
       VALUES ($1, $2, $3, $4, 'available', 'coach')`,
      [randomUUID(), squadId, teamId, membershipId],
    );
    return membershipId;
  }

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await active.undoLastMigration();
      remaining -= 1;
    }
    await active.destroy();
  });

  it('proves the schema migrates from empty and creates every squad table', async () => {
    const rows: { relation: string | null }[] = await active.query(
      `SELECT to_regclass('public.squads') AS relation
       UNION ALL SELECT to_regclass('public.squad_selections')
       UNION ALL SELECT to_regclass('public.squad_selection_events')
       UNION ALL SELECT to_regclass('public.squad_availability')`,
    );
    expect(rows.map(row => row.relation)).toEqual([
      'squads',
      'squad_selections',
      'squad_selection_events',
      'squad_availability',
    ]);
  });

  it('creates a draft squad and records the created event atomically', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Nationals Squad'),
    });
    expect(squad.status).toBe('draft');
    expect(squad.policyVersion).toBe('eligibility-signals-v1');
    expect(squad.revision).toBe(1);
    expect(await eventCount(squad.squadId, 'squad.created.v1')).toBe(1);
    expect(await auditCount(squad.squadId, 'squad.created')).toBe(1);
  });

  it('enforces one squad name per team, season, and competition scope', async () => {
    const { teamId, seasonId } = await seedTeamSeason();
    const insert = (id: string): Promise<unknown> =>
      active.query(
        `INSERT INTO "squads" ("id", "team_id", "season_id", "name")
         VALUES ($1, $2, $3, 'Nationals')`,
        [id, teamId, seasonId],
      );
    await insert(randomUUID());
    await expect(insert(randomUUID())).rejects.toThrow();
  });

  it('rejects an overridden selection that carries no override reason', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Check Squad'),
    });
    const membershipId = await seedMember(teamId, seasonId);
    await expect(
      active.query(
        `INSERT INTO "squad_selections" ("id", "squad_id", "team_id",
           "membership_id", "eligibility_overridden", "eligibility_snapshot")
         VALUES ($1, $2, $3, $4, true, 'overridden')`,
        [randomUUID(), squad.squadId, teamId, membershipId],
      ),
    ).rejects.toThrow();
  });

  it('allows at most one captain per squad', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Captain Squad'),
    });
    const first = await seedMember(teamId, seasonId);
    const second = await seedMember(teamId, seasonId);
    const insertCaptain = (membershipId: string): Promise<unknown> =>
      active.query(
        `INSERT INTO "squad_selections" ("id", "squad_id", "team_id",
           "membership_id", "selection_role", "eligibility_snapshot")
         VALUES ($1, $2, $3, $4, 'captain', 'passed')`,
        [randomUUID(), squad.squadId, teamId, membershipId],
      );
    await insertCaptain(first);
    await expect(insertCaptain(second)).rejects.toThrow();
  });

  it('reports a null attendance percentage when no session was eligible', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Unknown Attendance Squad'),
    });
    const membershipId = await seedMember(teamId, seasonId, {
      fullName: 'Aya Null',
    });
    const report = await eligibilityReport.report(teamId, squad.squadId, PAGE);
    const candidate = report.candidates.find(
      item => item.membershipId === membershipId,
    );
    expect(candidate?.attendancePct).toBeNull();
    expect(
      candidate?.signals.find(item => item.code === SignalCode.Attendance)
        ?.status,
    ).toBe(SignalStatus.Unknown);
  });

  it('computes the attendance signal at, above, and below the threshold', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Threshold Squad', 50),
    });
    const first = await seedSession(teamId, seasonId);
    const second = await seedSession(teamId, seasonId);
    const perfect = await seedMember(teamId, seasonId);
    const boundary = await seedMember(teamId, seasonId);
    const below = await seedMember(teamId, seasonId);
    const excusedOnly = await seedMember(teamId, seasonId);
    await seedAttendance(first, teamId, seasonId, perfect, 'present_on_time');
    await seedAttendance(second, teamId, seasonId, perfect, 'present_late');
    await seedAttendance(first, teamId, seasonId, boundary, 'present_on_time');
    await seedAttendance(second, teamId, seasonId, boundary, 'absent');
    await seedAttendance(first, teamId, seasonId, below, 'absent');
    await seedAttendance(second, teamId, seasonId, below, 'absent');
    await seedAttendance(first, teamId, seasonId, excusedOnly, 'excused');
    const report = await eligibilityReport.report(teamId, squad.squadId, PAGE);
    const find = (membershipId: string) =>
      report.candidates.find(item => item.membershipId === membershipId);
    expect(find(perfect)?.attendancePct).toBe(100);
    expect(find(boundary)?.attendancePct).toBe(50);
    expect(find(below)?.attendancePct).toBe(0);
    expect(find(excusedOnly)?.attendancePct).toBeNull();
    const attendanceOf = (membershipId: string) =>
      find(membershipId)?.signals.find(
        item => item.code === SignalCode.Attendance,
      )?.status;
    expect(attendanceOf(boundary)).toBe(SignalStatus.Passed);
    expect(attendanceOf(below)).toBe(SignalStatus.Warning);
    expect(attendanceOf(excusedOnly)).toBe(SignalStatus.Unknown);
  });

  it('surfaces an injured candidate as limited availability, never as a rejection', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Injury Squad'),
    });
    const session = await seedSession(teamId, seasonId);
    const membershipId = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
    );
    await seedAttendance(session, teamId, seasonId, membershipId, 'injured');
    const report = await eligibilityReport.report(teamId, squad.squadId, PAGE);
    const candidate = report.candidates.find(
      item => item.membershipId === membershipId,
    );
    expect(
      candidate?.signals.find(item => item.code === SignalCode.Injury)?.status,
    ).toBe(SignalStatus.Warning);
    expect(Object.keys(candidate ?? {})).toEqual([
      'membershipId',
      'fullName',
      'jerseyNumber',
      'attendancePct',
      'availability',
      'selected',
      'signals',
      'overall',
      'flagged',
    ]);
    const selected = await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(membershipId),
      override: { overrideReason: 'cleared by physio' },
    });
    expect(selected.eligibilityOverridden).toBe(true);
  });

  it('selects a clear candidate without any override', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Clear Squad'),
    });
    const membershipId = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
    );
    const selection = await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(membershipId),
      override: null,
    });
    expect(selection.eligibilityOverridden).toBe(false);
    expect(selection.eligibilitySnapshot).toBe(SignalStatus.Unknown);
    expect(selection.selectedBy).toBe(actor.userId);
    expect(await auditCount(membershipId, 'squad.selection.recorded')).toBe(1);
  });

  it('refuses a flagged candidate without an override and records one with it', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Flagged Squad'),
    });
    const membershipId = await seedMember(teamId, seasonId, {
      status: 'suspended',
      jerseyNumber: 9,
    });
    await expect(
      selectPlayer.execute(actor, teamId, squad.squadId, {
        content: selectionContent(membershipId),
        override: null,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.squads.eligibilityOverrideRequired',
    });
    const selection = await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(membershipId),
      override: { overrideReason: 'disciplinary review closed' },
    });
    expect(selection.eligibilityOverridden).toBe(true);
    expect(selection.overrideReason).toBe('disciplinary review closed');
    expect(selection.overriddenBy).toBe(actor.userId);
    expect(selection.eligibilitySnapshot).toContain(SignalStatus.Overridden);
    expect(await auditCount(membershipId, 'squad.selection.overridden')).toBe(
      1,
    );
  });

  it('rejects selecting a member of another team as an unknown candidate', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const other = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Cross Team Squad'),
    });
    const foreign = await seedMember(other.teamId, other.seasonId);
    await expect(
      selectPlayer.execute(actor, teamId, squad.squadId, {
        content: selectionContent(foreign),
        override: null,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.squads.candidateNotFound',
    });
  });

  it('hides another team’s squad behind a not-found lookup', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const other = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Hidden Squad'),
    });
    await expect(
      squadQuery.getById(other.teamId, squad.squadId),
    ).rejects.toMatchObject({ messageKey: 'errors.squads.squadNotFound' });
  });

  it('publishes a squad, emitting squad.published with the selection count', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Publish Squad'),
    });
    const membershipId = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
    );
    await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(membershipId),
      override: null,
    });
    const published = await transitionSquad.execute(
      actor,
      teamId,
      squad.squadId,
      {
        transition: SquadTransition.Publish,
        expectedRecordVersion: squad.recordVersion,
      },
    );
    expect(published.status).toBe('published');
    expect(published.publishedBy).toBe(actor.userId);
    expect(published.publishedAt?.toISOString()).toBe(NOW.toISOString());
    expect(await eventCount(squad.squadId, 'squad.published.v1')).toBe(1);
    const rows: { payload: { selectionCount: number } }[] = await active.query(
      `SELECT "payload" FROM "outbox_events"
        WHERE "aggregate_id" = $1 AND "event_type" = 'squad.published.v1'`,
      [squad.squadId],
    );
    expect(rows[0]?.payload.selectionCount).toBe(1);
  });

  it('rolls the whole publish transaction back when the version guard misses', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Guarded Squad'),
    });
    await expect(
      transitionSquad.execute(actor, teamId, squad.squadId, {
        transition: SquadTransition.Publish,
        expectedRecordVersion: squad.recordVersion + 99,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.squads.squadVersionConflict',
    });
    expect(await eventCount(squad.squadId, 'squad.published.v1')).toBe(0);
    const reloaded = await squadQuery.getById(teamId, squad.squadId);
    expect(reloaded.status).toBe('draft');
  });

  it('freezes selection on a locked squad and reopens it on revise', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Locked Squad'),
    });
    const membershipId = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
    );
    const published = await transitionSquad.execute(
      actor,
      teamId,
      squad.squadId,
      {
        transition: SquadTransition.Publish,
        expectedRecordVersion: squad.recordVersion,
      },
    );
    const locked = await transitionSquad.execute(actor, teamId, squad.squadId, {
      transition: SquadTransition.Lock,
      expectedRecordVersion: published.recordVersion,
    });
    expect(locked.lockedAt?.toISOString()).toBe(NOW.toISOString());
    expect(await eventCount(squad.squadId, 'squad.locked.v1')).toBe(1);
    await expect(
      selectPlayer.execute(actor, teamId, squad.squadId, {
        content: selectionContent(membershipId),
        override: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.squads.squadLocked' });
    const revised = await transitionSquad.execute(
      actor,
      teamId,
      squad.squadId,
      {
        transition: SquadTransition.Revise,
        expectedRecordVersion: locked.recordVersion,
      },
    );
    expect(revised.status).toBe('draft');
    expect(revised.revision).toBe(2);
    const reselected = await selectPlayer.execute(
      actor,
      teamId,
      squad.squadId,
      { content: selectionContent(membershipId), override: null },
    );
    expect(reselected.status).toBe('selected');
  });

  it('rejects an unreachable lifecycle transition', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Transition Squad'),
    });
    await expect(
      transitionSquad.execute(actor, teamId, squad.squadId, {
        transition: SquadTransition.Lock,
        expectedRecordVersion: squad.recordVersion,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.squads.squadInvalidTransition',
    });
  });

  it('keeps a removed selection and its append-only history', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'History Squad'),
    });
    const membershipId = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
    );
    await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(membershipId),
      override: null,
    });
    const removed = await removeSelection.execute(
      actor,
      teamId,
      squad.squadId,
      { membershipId, reason: 'travelling' },
    );
    expect(removed.status).toBe('removed');
    expect(removed.removedBy).toBe(actor.userId);
    const page = await selectionQuery.listForSquad(teamId, squad.squadId, PAGE);
    expect(page.total).toBe(1);
    const history: { event_type: string }[] = await active.query(
      `SELECT "event_type" FROM "squad_selection_events"
        WHERE "squad_id" = $1 AND "membership_id" = $2
        ORDER BY "occurred_at" ASC, "event_type" ASC`,
      [squad.squadId, membershipId],
    );
    expect(history.map(row => row.event_type).sort()).toEqual([
      'removed',
      'selected',
    ]);
    await expect(
      removeSelection.execute(actor, teamId, squad.squadId, {
        membershipId,
        reason: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.squads.selectionNotFound' });
  });

  it('lets a member declare availability once, resolved from their identity', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Availability Squad'),
    });
    const membershipId = await seedMember(teamId, seasonId, {
      userId: actor.userId,
    });
    const first = await declareAvailability.execute(
      actor,
      teamId,
      squad.squadId,
      { availability: AvailabilityStatus.Tentative, reason: 'exams' },
    );
    expect(first.membershipId).toBe(membershipId);
    expect(first.source).toBe('self');
    const second = await declareAvailability.execute(
      actor,
      teamId,
      squad.squadId,
      { availability: AvailabilityStatus.Available, reason: null },
    );
    expect(second.availabilityId).toBe(first.availabilityId);
    expect(second.recordVersion).toBe(first.recordVersion + 1);
    const page = await availabilityQuery.listForSquad(
      teamId,
      squad.squadId,
      PAGE,
    );
    expect(page.total).toBe(1);
  });

  it('refuses an availability declaration from a principal with no membership', async () => {
    const actor = await seedActor();
    const stranger = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Stranger Squad'),
    });
    await expect(
      declareAvailability.execute(stranger, teamId, squad.squadId, {
        availability: AvailabilityStatus.Available,
        reason: null,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.squads.availabilityMembershipNotFound',
    });
  });

  it('summarizes the advisory gender ratio of the selected players only', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Ratio Squad'),
    });
    const man = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
      'man',
    );
    const woman = await seedClearCandidate(
      teamId,
      seasonId,
      squad.squadId,
      'woman',
    );
    await seedClearCandidate(teamId, seasonId, squad.squadId, 'man');
    await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(man),
      override: null,
    });
    await selectPlayer.execute(actor, teamId, squad.squadId, {
      content: selectionContent(woman),
      override: null,
    });
    const report = await eligibilityReport.report(teamId, squad.squadId, PAGE);
    expect(report.selectedGenderRatio).toMatchObject({
      men: 1,
      women: 1,
      total: 2,
      balanced: true,
    });
    expect(report.total).toBe(3);
    expect(report.attendanceThresholdPct).toBe(70);
    expect(report.policyVersion).toBe('eligibility-signals-v1');
  });

  it('excludes archived and anonymized memberships from the candidate pool', async () => {
    const actor = await seedActor();
    const { teamId, seasonId } = await seedTeamSeason();
    const squad = await createSquad.execute(actor, teamId, {
      content: squadContent(seasonId, 'Pool Squad'),
    });
    const activeMember = await seedMember(teamId, seasonId);
    await seedMember(teamId, seasonId, { status: 'archived' });
    await seedMember(teamId, seasonId, { status: 'anonymized' });
    const report = await eligibilityReport.report(teamId, squad.squadId, PAGE);
    expect(report.total).toBe(1);
    expect(report.candidates.map(item => item.membershipId)).toEqual([
      activeMember,
    ]);
  });

  it('rejects a squad whose season belongs to another team', async () => {
    const actor = await seedActor();
    const { teamId } = await seedTeamSeason();
    const other = await seedTeamSeason();
    await expect(
      createSquad.execute(actor, teamId, {
        content: squadContent(other.seasonId, 'Foreign Season Squad'),
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.squads.scopeNotFound' });
  });
});
