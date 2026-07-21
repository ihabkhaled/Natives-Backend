import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import { CreateMatchUseCase } from '@modules/matches/application/create-match.use-case';
import { CreateMatchRulesetUseCase } from '@modules/matches/application/create-match-ruleset.use-case';
import { FinalizeMatchUseCase } from '@modules/matches/application/finalize-match.use-case';
import { MatchEventQueryService } from '@modules/matches/application/match-event-query.service';
import { MatchLookupService } from '@modules/matches/application/match-lookup.service';
import { MatchQueryService } from '@modules/matches/application/match-query.service';
import { MatchRevisionQueryService } from '@modules/matches/application/match-revision-query.service';
import { MatchRulesetQueryService } from '@modules/matches/application/match-ruleset-query.service';
import { MatchScopeService } from '@modules/matches/application/match-scope.service';
import { MatchScoreboardService } from '@modules/matches/application/match-scoreboard.service';
import { MatchStreamService } from '@modules/matches/application/match-stream.service';
import { RecordMatchPointUseCase } from '@modules/matches/application/record-match-point.use-case';
import { RecordMatchTimeoutUseCase } from '@modules/matches/application/record-match-timeout.use-case';
import { ReopenMatchUseCase } from '@modules/matches/application/reopen-match.use-case';
import { TransitionMatchUseCase } from '@modules/matches/application/transition-match.use-case';
import { VoidMatchEventUseCase } from '@modules/matches/application/void-match-event.use-case';
import { MatchRepository } from '@modules/matches/infrastructure/match.repository';
import { MatchEventRepository } from '@modules/matches/infrastructure/match-event.repository';
import { MatchRevisionRepository } from '@modules/matches/infrastructure/match-revision.repository';
import { MatchRulesetRepository } from '@modules/matches/infrastructure/match-ruleset.repository';
import { MatchScopeRepository } from '@modules/matches/infrastructure/match-scope.repository';
import {
  CapKind,
  MatchEventType,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
  MatchTransition,
  OperationOutcome,
  RulesetStatus,
  ScoringSide,
} from '@modules/matches/model/matches.enums';
import type { MatchRulesetContent } from '@modules/matches/model/matches.types';
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
import { SquadsSchema1723400000000 } from '../../src/database/migrations/1723400000000-squads-schema';
import { RostersSchema1723500000000 } from '../../src/database/migrations/1723500000000-rosters-schema';
import { MatchesSchema1723600000000 } from '../../src/database/migrations/1723600000000-matches-schema';
import { MatchLineupsSchema1723700000000 } from '../../src/database/migrations/1723700000000-match-lineups-schema';
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
const PAGE = { limit: 100, offset: 0 };

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
  ? 'Matches integration (PostgreSQL)'
  : `Matches integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const scopeRepo = new MatchScopeRepository();
  const rulesetRepo = new MatchRulesetRepository();
  const matchRepo = new MatchRepository();
  const eventRepo = new MatchEventRepository();
  const revisionRepo = new MatchRevisionRepository();
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
  const scopeService = new MatchScopeService(scopeRepo);
  const lookup = new MatchLookupService(matchRepo, rulesetRepo);
  const stream = new MatchStreamService(matchRepo, eventRepo);
  const createRuleset = new CreateMatchRulesetUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    rulesetRepo,
    audit,
  );
  const createMatch = new CreateMatchUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    scopeService,
    rulesetRepo,
    matchRepo,
    audit,
  );
  const transitionMatch = new TransitionMatchUseCase(
    unitOfWork,
    CLOCK,
    lookup,
    matchRepo,
    audit,
    events,
  );
  const recordPoint = new RecordMatchPointUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    scopeService,
    stream,
    audit,
  );
  const recordTimeout = new RecordMatchTimeoutUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    stream,
    eventRepo,
    audit,
  );
  const voidEvent = new VoidMatchEventUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    stream,
    audit,
  );
  const finalizeMatch = new FinalizeMatchUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    matchRepo,
    revisionRepo,
    audit,
    events,
  );
  const reopenMatch = new ReopenMatchUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    matchRepo,
    revisionRepo,
    audit,
    events,
  );
  const matchQuery = new MatchQueryService(unitOfWork, matchRepo, lookup);
  const eventQuery = new MatchEventQueryService(unitOfWork, lookup, eventRepo);
  const revisionQuery = new MatchRevisionQueryService(
    unitOfWork,
    lookup,
    revisionRepo,
  );
  const rulesetQuery = new MatchRulesetQueryService(unitOfWork, rulesetRepo);
  const scoreboard = new MatchScoreboardService(
    unitOfWork,
    CLOCK,
    lookup,
    eventRepo,
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
    fixtureId: string;
  }> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const competitionId = randomUUID();
    const opponentId = randomUUID();
    const fixtureId = randomUUID();
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
    await active.query(
      `INSERT INTO "opponents" ("id", "team_id", "name") VALUES ($1, $2, $3)`,
      [opponentId, teamId, `Opponent ${opponentId.slice(0, 6)}`],
    );
    await active.query(
      `INSERT INTO "fixtures" ("id", "competition_id", "team_id", "season_id",
         "opponent_id", "home_away", "scheduled_at")
       VALUES ($1, $2, $3, $4, $5, 'away', '2026-05-01T09:00:00.000Z')`,
      [fixtureId, competitionId, teamId, seasonId, opponentId],
    );
    return { teamId, seasonId, competitionId, fixtureId };
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
       VALUES ($1, $2, $3, $4, $5, 'home', '2026-05-02T09:00:00.000Z')`,
      [fixtureId, competitionId, teamId, seasonId, opponentId],
    );
    return fixtureId;
  }

  function rulesetContent(
    overrides: Partial<MatchRulesetContent> = {},
  ): MatchRulesetContent {
    return {
      rulesetKey: 'wfdf-indoor',
      seasonId: null,
      name: 'Indoor',
      gameTo: 15,
      winBy: 1,
      hardCap: null,
      softCapMinutes: null,
      softCapPlus: null,
      timeCapMinutes: null,
      halftimeAt: null,
      timeoutsPerTeam: 2,
      timeoutsPerPeriod: 1,
      periods: 2,
      opponentErrorAttribution: false,
      notes: null,
      ...overrides,
    };
  }

  async function startedMatch(
    overrides: Partial<MatchRulesetContent> = {},
  ): Promise<{
    actor: AuthUserIdentity;
    teamId: string;
    matchId: string;
    recordVersion: number;
  }> {
    const actor = await seedActor();
    const scope = await seedScope();
    await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(overrides),
    });
    const match = await createMatch.execute(actor, scope.teamId, {
      content: {
        fixtureId: scope.fixtureId,
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    const ready = await transitionMatch.execute(
      actor,
      scope.teamId,
      match.matchId,
      {
        transition: MatchTransition.Ready,
        expectedRecordVersion: match.recordVersion,
        reason: null,
      },
    );
    const live = await transitionMatch.execute(
      actor,
      scope.teamId,
      match.matchId,
      {
        transition: MatchTransition.Start,
        expectedRecordVersion: ready.recordVersion,
        reason: null,
      },
    );
    return {
      actor,
      teamId: scope.teamId,
      matchId: match.matchId,
      recordVersion: live.recordVersion,
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

  it('proves the schema migrates from empty and creates every match table', async () => {
    const rows: { relation: string | null }[] = await active.query(
      `SELECT to_regclass('public.match_rulesets') AS relation
       UNION ALL SELECT to_regclass('public.matches')
       UNION ALL SELECT to_regclass('public.match_events')
       UNION ALL SELECT to_regclass('public.match_revisions')`,
    );
    expect(rows.map(row => row.relation)).toEqual([
      'match_rulesets',
      'matches',
      'match_events',
      'match_revisions',
    ]);
  });

  it('publishes a versioned ruleset and archives the previous active one', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const first = await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(),
    });
    const second = await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent({ gameTo: 13, hardCap: 15 }),
    });
    expect(first.rulesetVersion).toBe(1);
    expect(second.rulesetVersion).toBe(2);
    expect(second.hardCap).toBe(15);
    const page = await rulesetQuery.listForTeam(scope.teamId, PAGE);
    expect(page.total).toBe(2);
    expect(
      page.items.filter(item => item.status === RulesetStatus.Active),
    ).toHaveLength(1);
    expect(await auditCount(second.rulesetId, 'match.ruleset.created')).toBe(1);
  });

  it('keeps an unconfigured cap NULL in the database, never zero', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const ruleset = await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(),
    });
    expect(ruleset.hardCap).toBeNull();
    expect(ruleset.softCapMinutes).toBeNull();
    expect(ruleset.timeCapMinutes).toBeNull();
    expect(ruleset.halftimeAt).toBeNull();
    const rows: { hard_cap: number | null }[] = await active.query(
      `SELECT "hard_cap" FROM "match_rulesets" WHERE "id" = $1`,
      [ruleset.rulesetId],
    );
    expect(rows[0]?.hard_cap).toBeNull();
  });

  it('creates a match pinned to the active ruleset and records the audit', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const ruleset = await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(),
    });
    const match = await createMatch.execute(actor, scope.teamId, {
      content: {
        fixtureId: scope.fixtureId,
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    expect(match.status).toBe(MatchStatus.Scheduled);
    expect(match.rulesetId).toBe(ruleset.rulesetId);
    expect(match.homeAway).toBe('away');
    expect(match.seasonId).toBe(scope.seasonId);
    expect(match.ourScore).toBe(0);
    expect(match.streamVersion).toBe(0);
    expect(await auditCount(match.matchId, 'match.created')).toBe(1);
  });

  it('allows only one non-abandoned match per fixture', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(),
    });
    await createMatch.execute(actor, scope.teamId, {
      content: {
        fixtureId: scope.fixtureId,
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    await expect(
      createMatch.execute(actor, scope.teamId, {
        content: {
          fixtureId: scope.fixtureId,
          rosterId: null,
          rulesetId: null,
          notes: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('hides a fixture from another team behind a not-found scope', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    const other = await seedScope();
    await createRuleset.execute(actor, other.teamId, {
      content: rulesetContent(),
    });
    await expect(
      createMatch.execute(actor, other.teamId, {
        content: {
          fixtureId: scope.fixtureId,
          rosterId: null,
          rulesetId: null,
          notes: null,
        },
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.scopeNotFound' });
  });

  it('starts a match and enqueues started plus state_changed atomically', async () => {
    const { matchId } = await startedMatch();
    expect(await eventCount(matchId, 'match.started.v1')).toBe(1);
    expect(await eventCount(matchId, 'match.state_changed.v1')).toBe(2);
    expect(await auditCount(matchId, 'match.transitioned')).toBe(2);
  });

  it('derives the score solely from accepted point events', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const second = await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Them,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    expect(second.outcome).toBe(OperationOutcome.Applied);
    expect(second.ourScore).toBe(1);
    expect(second.opponentScore).toBe(1);
    expect(second.streamVersion).toBe(2);
    const feed = await eventQuery.listForMatch(teamId, matchId, PAGE);
    expect(feed.total).toBe(2);
    expect(feed.items.map(item => item.sequence)).toEqual([1, 2]);
  });

  it('replays the same operation id to one score change, not two', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const operationId = `op-${randomUUID()}`;
    const content = {
      operationId,
      scoringSide: ScoringSide.Us,
      points: 1,
      scorerMembershipId: null,
      assistMembershipId: null,
      occurredAt: null,
      expectedStreamVersion: null,
    };
    const first = await recordPoint.execute(actor, teamId, matchId, {
      content,
    });
    const replay = await recordPoint.execute(actor, teamId, matchId, {
      content,
    });
    expect(first.outcome).toBe(OperationOutcome.Applied);
    expect(replay.outcome).toBe(OperationOutcome.Replayed);
    expect(replay.event.eventId).toBe(first.event.eventId);
    expect(replay.ourScore).toBe(1);
    expect(replay.streamVersion).toBe(1);
    const feed = await eventQuery.listForMatch(teamId, matchId, PAGE);
    expect(feed.total).toBe(1);
    const match = await matchQuery.getById(teamId, matchId);
    expect(match.ourScore).toBe(1);
  });

  it('rejects the same operation id carrying a different payload', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const operationId = `op-${randomUUID()}`;
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    await expect(
      recordPoint.execute(actor, teamId, matchId, {
        content: {
          operationId,
          scoringSide: ScoringSide.Them,
          points: 1,
          scorerMembershipId: null,
          assistMembershipId: null,
          occurredAt: null,
          expectedStreamVersion: null,
        },
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.operationConflict',
    });
    const match = await matchQuery.getById(teamId, matchId);
    expect(match.ourScore).toBe(1);
    expect(match.opponentScore).toBe(0);
  });

  it('rejects a stale base stream version from a second device', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: 0,
      },
    });
    await expect(
      recordPoint.execute(actor, teamId, matchId, {
        content: {
          operationId: `op-${randomUUID()}`,
          scoringSide: ScoringSide.Us,
          points: 1,
          scorerMembershipId: null,
          assistMembershipId: null,
          occurredAt: null,
          expectedStreamVersion: 0,
        },
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.matchVersionConflict',
    });
  });

  it('rolls the whole append back when the operation id collides', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const operationId = `op-${randomUUID()}`;
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    await expect(
      recordPoint.execute(actor, teamId, matchId, {
        content: {
          operationId,
          scoringSide: ScoringSide.Us,
          points: 2,
          scorerMembershipId: null,
          assistMembershipId: null,
          occurredAt: null,
          expectedStreamVersion: null,
        },
      }),
    ).rejects.toThrow();
    const feed = await eventQuery.listForMatch(teamId, matchId, PAGE);
    expect(feed.total).toBe(1);
  });

  it('applies the versioned hard cap to the projected cap state', async () => {
    const { actor, teamId, matchId } = await startedMatch({
      gameTo: 2,
      hardCap: 2,
    });
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 2,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const board = await scoreboard.getForMatch(teamId, matchId);
    expect(board.capApplied).toBe(CapKind.Hard);
    expect(board.complete).toBe(true);
    expect(board.target).toBe(2);
    expect(board.rulesetKey).toBe('wfdf-indoor');
    expect(board.engineVersion).toBe('match-scoring-v1');
  });

  it('enforces the versioned timeout allowance per period', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordTimeout.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        occurredAt: null,
      },
    });
    await expect(
      recordTimeout.execute(actor, teamId, matchId, {
        content: {
          operationId: `op-${randomUUID()}`,
          scoringSide: ScoringSide.Us,
          occurredAt: null,
        },
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.timeoutsExhausted',
    });
    const board = await scoreboard.getForMatch(teamId, matchId);
    expect(board.timeouts.remainingForUs).toBe(0);
    expect(board.timeouts.remainingForThem).toBe(1);
  });

  it('resets the timeout budget when the second period begins', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordTimeout.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        occurredAt: null,
      },
    });
    const live = await matchQuery.getById(teamId, matchId);
    const halftime = await transitionMatch.execute(actor, teamId, matchId, {
      transition: MatchTransition.Halftime,
      expectedRecordVersion: live.recordVersion,
      reason: null,
    });
    const resumed = await transitionMatch.execute(actor, teamId, matchId, {
      transition: MatchTransition.Resume,
      expectedRecordVersion: halftime.recordVersion,
      reason: null,
    });
    expect(resumed.period).toBe(2);
    const board = await scoreboard.getForMatch(teamId, matchId);
    expect(board.timeouts.remainingForUs).toBe(1);
  });

  it('undoes a point by appending a void, never by rewriting history', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const scored = await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const voided = await voidEvent.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        eventId: scored.event.eventId,
        reason: 'credited to the wrong side',
      },
    });
    expect(voided.ourScore).toBe(0);
    const feed = await eventQuery.listForMatch(teamId, matchId, PAGE);
    expect(feed.total).toBe(2);
    const original = feed.items.find(
      item => item.eventId === scored.event.eventId,
    );
    expect(original?.voided).toBe(true);
    expect(original?.points).toBe(1);
    const compensation = feed.items.find(
      item => item.eventType === MatchEventType.Void,
    );
    expect(compensation?.voidsEventId).toBe(scored.event.eventId);
    expect(compensation?.voidReason).toBe('credited to the wrong side');
  });

  it('refuses to void the same fact twice', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const scored = await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    await voidEvent.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        eventId: scored.event.eventId,
        reason: 'credited to the wrong side',
      },
    });
    await expect(
      voidEvent.execute(actor, teamId, matchId, {
        content: {
          operationId: `op-${randomUUID()}`,
          eventId: scored.event.eventId,
          reason: 'credited to the wrong side again',
        },
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.operationConflict',
    });
  });

  it('refuses a stream write to a match that is not live', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(),
    });
    const match = await createMatch.execute(actor, scope.teamId, {
      content: {
        fixtureId: scope.fixtureId,
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    await expect(
      recordPoint.execute(actor, scope.teamId, match.matchId, {
        content: {
          operationId: `op-${randomUUID()}`,
          scoringSide: ScoringSide.Us,
          points: 1,
          scorerMembershipId: null,
          assistMembershipId: null,
          occurredAt: null,
          expectedStreamVersion: null,
        },
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.matchNotScoring' });
  });

  it('finalizes a completed match and records an immutable revision', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 2,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const live = await matchQuery.getById(teamId, matchId);
    const completed = await transitionMatch.execute(actor, teamId, matchId, {
      transition: MatchTransition.Complete,
      expectedRecordVersion: live.recordVersion,
      reason: null,
    });
    expect(completed.result).toBe(MatchResult.Win);
    const finalized = await finalizeMatch.execute(actor, teamId, matchId, {
      expectedRecordVersion: completed.recordVersion,
      ourScore: null,
      opponentScore: null,
    });
    expect(finalized.status).toBe(MatchStatus.Finalized);
    expect(finalized.finalizedAt?.toISOString()).toBe(NOW.toISOString());
    expect(await eventCount(matchId, 'match.finalized.v1')).toBe(1);
    const trail = await revisionQuery.listForMatch(teamId, matchId, PAGE);
    expect(trail.total).toBe(1);
    expect(trail.items[0]?.action).toBe(MatchRevisionAction.Finalized);
    expect(trail.items[0]?.ourScoreAfter).toBe(2);
  });

  it('never merges a final score a caller asserts that the stream disagrees with', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 2,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const live = await matchQuery.getById(teamId, matchId);
    const completed = await transitionMatch.execute(actor, teamId, matchId, {
      transition: MatchTransition.Complete,
      expectedRecordVersion: live.recordVersion,
      reason: null,
    });
    await expect(
      finalizeMatch.execute(actor, teamId, matchId, {
        expectedRecordVersion: completed.recordVersion,
        ourScore: 3,
        opponentScore: 0,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.operationConflict',
    });
    const reloaded = await matchQuery.getById(teamId, matchId);
    expect(reloaded.status).toBe(MatchStatus.Completed);
    expect(reloaded.ourScore).toBe(2);
  });

  async function finalizedMatch(): Promise<{
    actor: AuthUserIdentity;
    teamId: string;
    matchId: string;
    recordVersion: number;
  }> {
    const started = await startedMatch();
    await recordPoint.execute(started.actor, started.teamId, started.matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 2,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const live = await matchQuery.getById(started.teamId, started.matchId);
    const completed = await transitionMatch.execute(
      started.actor,
      started.teamId,
      started.matchId,
      {
        transition: MatchTransition.Complete,
        expectedRecordVersion: live.recordVersion,
        reason: null,
      },
    );
    const finalized = await finalizeMatch.execute(
      started.actor,
      started.teamId,
      started.matchId,
      {
        expectedRecordVersion: completed.recordVersion,
        ourScore: null,
        opponentScore: null,
      },
    );
    return {
      actor: started.actor,
      teamId: started.teamId,
      matchId: started.matchId,
      recordVersion: finalized.recordVersion,
    };
  }

  it('refuses every plain transition and score event on a finalized match', async () => {
    const { actor, teamId, matchId, recordVersion } = await finalizedMatch();
    await expect(
      transitionMatch.execute(actor, teamId, matchId, {
        transition: MatchTransition.Start,
        expectedRecordVersion: recordVersion,
        reason: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.matchFinalized' });
    await expect(
      recordPoint.execute(actor, teamId, matchId, {
        content: {
          operationId: `op-${randomUUID()}`,
          scoringSide: ScoringSide.Us,
          points: 1,
          scorerMembershipId: null,
          assistMembershipId: null,
          occurredAt: null,
          expectedStreamVersion: null,
        },
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.matchFinalized' });
    await expect(
      finalizeMatch.execute(actor, teamId, matchId, {
        expectedRecordVersion: recordVersion,
        ourScore: null,
        opponentScore: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.matchFinalized' });
  });

  it('refuses an in-place edit of a finalized match at the database level', async () => {
    const { matchId } = await finalizedMatch();
    await expect(
      active.query(`UPDATE "matches" SET "our_score" = 99 WHERE "id" = $1`, [
        matchId,
      ]),
    ).rejects.toThrow(/finalized and immutable/u);
    const rows: { our_score: number }[] = await active.query(
      `SELECT "our_score" FROM "matches" WHERE "id" = $1`,
      [matchId],
    );
    expect(rows[0]?.our_score).toBe(2);
  });

  it('refuses an append to the stream of a finalized match at the database level', async () => {
    const { matchId } = await finalizedMatch();
    const teamRows: { team_id: string }[] = await active.query(
      `SELECT "team_id" FROM "matches" WHERE "id" = $1`,
      [matchId],
    );
    await expect(
      active.query(
        `INSERT INTO "match_events" ("id", "match_id", "team_id", "sequence",
           "operation_id", "request_hash", "event_type", "scoring_side",
           "points", "our_score_after", "opponent_score_after")
         VALUES ($1, $2, $3, 99, $4, 'hash', 'point', 'us', 1, 99, 0)`,
        [randomUUID(), matchId, teamRows[0]?.team_id, `op-${randomUUID()}`],
      ),
    ).rejects.toThrow(/closed/u);
  });

  it('refuses to rewrite a recorded fact or a revision row', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const scored = await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Us,
        points: 1,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    await active.query(
      `UPDATE "match_events" SET "points" = 99, "our_score_after" = 99
        WHERE "id" = $1`,
      [scored.event.eventId],
    );
    const rows: { points: number; our_score_after: number }[] =
      await active.query(
        `SELECT "points", "our_score_after" FROM "match_events"
          WHERE "id" = $1`,
        [scored.event.eventId],
      );
    expect(rows[0]?.points).toBe(1);
    expect(rows[0]?.our_score_after).toBe(1);
  });

  it('corrects a finalized match only through an audited reopen', async () => {
    const { actor, teamId, matchId, recordVersion } = await finalizedMatch();
    const reopened = await reopenMatch.execute(actor, teamId, matchId, {
      reason: 'the second point was credited to the wrong side',
      expectedRecordVersion: recordVersion,
    });
    expect(reopened.status).toBe(MatchStatus.Live);
    expect(reopened.revision).toBe(2);
    expect(reopened.result).toBe(MatchResult.Undecided);
    expect(reopened.finalizedAt).toBeNull();
    expect(await eventCount(matchId, 'match.reopened.v1')).toBe(1);

    const corrected = await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Them,
        points: 3,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    expect(corrected.opponentScore).toBe(3);
    const live = await matchQuery.getById(teamId, matchId);
    const completed = await transitionMatch.execute(actor, teamId, matchId, {
      transition: MatchTransition.Complete,
      expectedRecordVersion: live.recordVersion,
      reason: null,
    });
    const refinalized = await finalizeMatch.execute(actor, teamId, matchId, {
      expectedRecordVersion: completed.recordVersion,
      ourScore: null,
      opponentScore: null,
    });
    expect(refinalized.result).toBe(MatchResult.Loss);

    const trail = await revisionQuery.listForMatch(teamId, matchId, PAGE);
    expect(trail.items.map(item => item.action)).toEqual([
      MatchRevisionAction.Finalized,
      MatchRevisionAction.Reopened,
      MatchRevisionAction.Corrected,
    ]);
    const correction = trail.items[2];
    expect(correction?.ourScoreBefore).toBe(2);
    expect(correction?.opponentScoreBefore).toBe(3);
    expect(correction?.opponentScoreAfter).toBe(3);
    expect(await auditCount(matchId, 'match.reopened')).toBe(1);
  });

  it('refuses to reopen a match that was never finalized', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const live = await matchQuery.getById(teamId, matchId);
    await expect(
      reopenMatch.execute(actor, teamId, matchId, {
        reason: 'too early to correct anything',
        expectedRecordVersion: live.recordVersion,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.reopenNotAllowed' });
  });

  it('rolls the whole transition back when the version guard misses', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    const live = await matchQuery.getById(teamId, matchId);
    await expect(
      transitionMatch.execute(actor, teamId, matchId, {
        transition: MatchTransition.Complete,
        expectedRecordVersion: live.recordVersion + 99,
        reason: null,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.matchVersionConflict',
    });
    const reloaded = await matchQuery.getById(teamId, matchId);
    expect(reloaded.status).toBe(MatchStatus.Live);
  });

  it('keeps an abandoned match UNDECIDED and requires a reason', async () => {
    const { actor, teamId, matchId } = await startedMatch();
    await recordPoint.execute(actor, teamId, matchId, {
      content: {
        operationId: `op-${randomUUID()}`,
        scoringSide: ScoringSide.Them,
        points: 3,
        scorerMembershipId: null,
        assistMembershipId: null,
        occurredAt: null,
        expectedStreamVersion: null,
      },
    });
    const live = await matchQuery.getById(teamId, matchId);
    await expect(
      transitionMatch.execute(actor, teamId, matchId, {
        transition: MatchTransition.Abandon,
        expectedRecordVersion: live.recordVersion,
        reason: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.validation' });
    const abandoned = await transitionMatch.execute(actor, teamId, matchId, {
      transition: MatchTransition.Abandon,
      expectedRecordVersion: live.recordVersion,
      reason: 'lightning on the field',
    });
    expect(abandoned.status).toBe(MatchStatus.Abandoned);
    expect(abandoned.result).toBe(MatchResult.Undecided);
    expect(abandoned.abandonReason).toBe('lightning on the field');
  });

  it('hides another team’s match behind a not-found lookup', async () => {
    const { teamId, matchId } = await startedMatch();
    const other = await seedScope();
    await expect(
      matchQuery.getById(other.teamId, matchId),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.matchNotFound' });
    expect(teamId).not.toBe(other.teamId);
  });

  it('lists matches under the allow-listed filters only', async () => {
    const actor = await seedActor();
    const scope = await seedScope();
    await createRuleset.execute(actor, scope.teamId, {
      content: rulesetContent(),
    });
    const first = await createMatch.execute(actor, scope.teamId, {
      content: {
        fixtureId: scope.fixtureId,
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    const secondFixture = await seedFixture(
      scope.teamId,
      scope.seasonId,
      scope.competitionId,
    );
    await createMatch.execute(actor, scope.teamId, {
      content: {
        fixtureId: secondFixture,
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    const all = await matchQuery.listForScope(
      scope.teamId,
      { competitionId: null, fixtureId: null, status: null },
      PAGE,
    );
    expect(all.total).toBe(2);
    const filtered = await matchQuery.listForScope(
      scope.teamId,
      { competitionId: null, fixtureId: scope.fixtureId, status: null },
      PAGE,
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.matchId).toBe(first.matchId);
  });
});
