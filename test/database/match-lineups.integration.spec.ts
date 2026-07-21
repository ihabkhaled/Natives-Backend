import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import { CompleteMatchPointUseCase } from '@modules/matches/application/complete-match-point.use-case';
import { CorrectMatchPlayUseCase } from '@modules/matches/application/correct-match-play.use-case';
import { CreateMatchUseCase } from '@modules/matches/application/create-match.use-case';
import { CreateMatchRulesetUseCase } from '@modules/matches/application/create-match-ruleset.use-case';
import { FinalizeMatchUseCase } from '@modules/matches/application/finalize-match.use-case';
import { MatchLineupService } from '@modules/matches/application/match-lineup.service';
import { MatchLookupService } from '@modules/matches/application/match-lookup.service';
import { MatchPlayQueryService } from '@modules/matches/application/match-play-query.service';
import { MatchPlayStreamService } from '@modules/matches/application/match-play-stream.service';
import { MatchScopeService } from '@modules/matches/application/match-scope.service';
import { MatchStatisticsService } from '@modules/matches/application/match-statistics.service';
import { RebuildMatchStatisticsUseCase } from '@modules/matches/application/rebuild-match-statistics.use-case';
import { RecordMatchPlayUseCase } from '@modules/matches/application/record-match-play.use-case';
import { StartMatchPointUseCase } from '@modules/matches/application/start-match-point.use-case';
import { TransitionMatchUseCase } from '@modules/matches/application/transition-match.use-case';
import { MatchRepository } from '@modules/matches/infrastructure/match.repository';
import { MatchPlayEventRepository } from '@modules/matches/infrastructure/match-play-event.repository';
import { MatchPointLineupRepository } from '@modules/matches/infrastructure/match-point-lineup.repository';
import { MatchRevisionRepository } from '@modules/matches/infrastructure/match-revision.repository';
import { MatchRosterRepository } from '@modules/matches/infrastructure/match-roster.repository';
import { MatchRulesetRepository } from '@modules/matches/infrastructure/match-ruleset.repository';
import { MatchScopeRepository } from '@modules/matches/infrastructure/match-scope.repository';
import {
  AssistState,
  MatchPlayType,
  MatchTransition,
  OperationOutcome,
  PointStartingLine,
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

const NOW = new Date('2026-05-01T09:00:00.000Z');
const CLOCK = { now: () => NOW, uptime: () => 0 };
const ID_GEN = { generate: () => randomUUID() };
const PAGE = { limit: 200, offset: 0 };

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
  ? 'Match lineups, possession events, and derived statistics (PostgreSQL)'
  : `Match lineups integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const scopeRepo = new MatchScopeRepository();
  const rulesetRepo = new MatchRulesetRepository();
  const matchRepo = new MatchRepository();
  const revisionRepo = new MatchRevisionRepository();
  const playRepo = new MatchPlayEventRepository();
  const lineupRepo = new MatchPointLineupRepository();
  const rosterRepo = new MatchRosterRepository();
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
  const playStream = new MatchPlayStreamService(playRepo);
  const lineupService = new MatchLineupService(
    ID_GEN,
    lineupRepo,
    rosterRepo,
    scopeService,
  );
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
  const startPoint = new StartMatchPointUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    playStream,
    lineupService,
    audit,
    events,
  );
  const completePoint = new CompleteMatchPointUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    playStream,
    audit,
    events,
  );
  const recordPlay = new RecordMatchPlayUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    playStream,
    scopeService,
    audit,
    events,
  );
  const correctPlay = new CorrectMatchPlayUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    lookup,
    playStream,
    audit,
    events,
  );
  const playQuery = new MatchPlayQueryService(unitOfWork, lookup, playRepo);
  const statistics = new MatchStatisticsService(
    unitOfWork,
    lookup,
    playRepo,
    lineupRepo,
    rosterRepo,
  );
  const rebuild = new RebuildMatchStatisticsUseCase(
    unitOfWork,
    lookup,
    statistics,
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

  async function seedMembership(teamId: string): Promise<string> {
    const userId = randomUUID();
    const membershipId = randomUUID();
    await active.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `player-${userId}@example.test`],
    );
    await active.query(
      `INSERT INTO "memberships" ("id", "user_id", "team_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [membershipId, userId, teamId],
    );
    return membershipId;
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

  interface Scene {
    readonly actor: AuthUserIdentity;
    readonly teamId: string;
    readonly matchId: string;
    readonly recordVersion: number;
    readonly members: readonly string[];
  }

  async function seedScene(
    overrides: Partial<MatchRulesetContent> = {},
    rosterSize = 3,
  ): Promise<Scene> {
    const actor = await seedActor();
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const competitionId = randomUUID();
    const opponentId = randomUUID();
    const fixtureId = randomUUID();
    const rosterId = randomUUID();
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
       VALUES ($1, $2, $3, $4, $5, 'home', '2026-05-01T09:00:00.000Z')`,
      [fixtureId, competitionId, teamId, seasonId, opponentId],
    );
    await active.query(
      `INSERT INTO "rosters" ("id", "team_id", "season_id", "competition_id",
         "fixture_id", "roster_kind", "name", "status")
       VALUES ($1, $2, $3, $4, $5, 'match', 'Match roster', 'draft')`,
      [rosterId, teamId, seasonId, competitionId, fixtureId],
    );
    const members: string[] = [];
    for (let index = 0; index < rosterSize; index += 1) {
      const membershipId = await seedMembership(teamId);
      members.push(membershipId);
      await active.query(
        `INSERT INTO "roster_entries" ("id", "roster_id", "team_id",
           "membership_id") VALUES ($1, $2, $3, $4)`,
        [randomUUID(), rosterId, teamId, membershipId],
      );
    }
    await createRuleset.execute(actor, teamId, {
      content: rulesetContent(overrides),
    });
    const match = await createMatch.execute(actor, teamId, {
      content: { fixtureId, rosterId, rulesetId: null, notes: null },
    });
    const ready = await transitionMatch.execute(actor, teamId, match.matchId, {
      transition: MatchTransition.Ready,
      expectedRecordVersion: match.recordVersion,
      reason: null,
    });
    const live = await transitionMatch.execute(actor, teamId, match.matchId, {
      transition: MatchTransition.Start,
      expectedRecordVersion: ready.recordVersion,
      reason: null,
    });
    return {
      actor,
      teamId,
      matchId: match.matchId,
      recordVersion: live.recordVersion,
      members: members.sort((left, right) => (left < right ? -1 : 1)),
    };
  }

  function operationId(): string {
    return `op-${randomUUID()}`;
  }

  async function openPoint(
    scene: Scene,
    startingLine: PointStartingLine,
    line: readonly string[],
  ): Promise<string> {
    const result = await startPoint.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
      {
        content: {
          operationId: operationId(),
          startingLine,
          lineMembershipIds: line,
          pullerMembershipId: line[0] ?? null,
          occurredAt: null,
          notes: null,
        },
      },
    );
    return result.play.playId;
  }

  async function closePoint(
    scene: Scene,
    scoringSide: ScoringSide,
  ): Promise<void> {
    await completePoint.execute(scene.actor, scene.teamId, scene.matchId, {
      content: {
        operationId: operationId(),
        scoringSide,
        durationSeconds: null,
        occurredAt: null,
        notes: null,
      },
    });
  }

  async function recordGoal(
    scene: Scene,
    scorer: string,
    assister: string | null,
  ): Promise<string> {
    const result = await recordPlay.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
      {
        content: {
          operationId: operationId(),
          playType: MatchPlayType.Goal,
          primaryMembershipId: scorer,
          secondaryMembershipId: assister,
          assistState:
            assister === null ? AssistState.None : AssistState.Recorded,
          callahan: false,
          occurredAt: null,
          notes: null,
        },
      },
    );
    return result.play.playId;
  }

  async function outboxCount(
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

  it('proves the schema migrates from empty and adds every 504 object', async () => {
    const rows: { relation: string | null }[] = await active.query(
      `SELECT to_regclass('public.match_play_events') AS relation
       UNION ALL SELECT to_regclass('public.match_point_lineups')`,
    );
    expect(rows.map(row => row.relation)).toEqual([
      'match_play_events',
      'match_point_lineups',
    ]);
    const columns: { column_name: string }[] = await active.query(
      `SELECT "column_name" FROM information_schema.columns
        WHERE "table_name" = 'match_rulesets'
          AND "column_name" = 'opponent_error_attribution'`,
    );
    expect(columns).toHaveLength(1);
  });

  it('stores NO statistics table — every figure is a projection', async () => {
    const rows: { relation: string | null }[] = await active.query(
      `SELECT to_regclass('public.match_statistics') AS relation
       UNION ALL SELECT to_regclass('public.player_match_stats')`,
    );
    expect(rows.map(row => row.relation)).toEqual([null, null]);
  });

  it('records a point lineup and derives points played from it', async () => {
    const scene = await seedScene();
    const line = scene.members.slice(0, 2);
    await openPoint(scene, PointStartingLine.Offense, line);
    await closePoint(scene, ScoringSide.Us);
    const projected = await statistics.getForMatch(scene.teamId, scene.matchId);
    expect(projected.lineupsRecorded).toBe(true);
    expect(projected.team.pointsCompleted).toBe(1);
    expect(projected.team.holds).toBe(1);
    for (const membershipId of line) {
      const player = projected.players.find(
        entry => entry.membershipId === membershipId,
      );
      expect(player?.pointsPlayed).toBe(1);
      expect(player?.offencePointsPlayed).toBe(1);
    }
  });

  it('keeps EVERY rostered player present, zero-stat ones at zero', async () => {
    const scene = await seedScene({}, 4);
    await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    await closePoint(scene, ScoringSide.Us);
    const projected = await statistics.getForMatch(scene.teamId, scene.matchId);
    expect(projected.players).toHaveLength(4);
    const benched = projected.players.find(
      player => player.membershipId === scene.members[3],
    );
    expect(benched?.rostered).toBe(true);
    expect(benched?.pointsPlayed).toBe(0);
    expect(benched?.rosterEntryId).not.toBeNull();
  });

  it('rejects a second insert of the same client operation id', async () => {
    const scene = await seedScene();
    const id = operationId();
    const content = {
      operationId: id,
      startingLine: PointStartingLine.Offense,
      lineMembershipIds: scene.members.slice(0, 2),
      pullerMembershipId: null,
      occurredAt: null,
      notes: null,
    };
    const first = await startPoint.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
      { content },
    );
    const replay = await startPoint.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
      { content },
    );
    expect(first.outcome).toBe(OperationOutcome.Applied);
    expect(replay.outcome).toBe(OperationOutcome.Replayed);
    expect(replay.play.playId).toBe(first.play.playId);
    expect(replay.lineup).toHaveLength(2);
    const feed = await playQuery.listForMatch(
      scene.teamId,
      scene.matchId,
      PAGE,
    );
    expect(feed.total).toBe(1);
  });

  it('refuses the same operation id with a different payload', async () => {
    const scene = await seedScene();
    const id = operationId();
    await startPoint.execute(scene.actor, scene.teamId, scene.matchId, {
      content: {
        operationId: id,
        startingLine: PointStartingLine.Offense,
        lineMembershipIds: scene.members.slice(0, 2),
        pullerMembershipId: null,
        occurredAt: null,
        notes: null,
      },
    });
    await expect(
      startPoint.execute(scene.actor, scene.teamId, scene.matchId, {
        content: {
          operationId: id,
          startingLine: PointStartingLine.Defense,
          lineMembershipIds: scene.members.slice(0, 2),
          pullerMembershipId: null,
          occurredAt: null,
          notes: null,
        },
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.operationConflict',
    });
  });

  it('refuses to rewrite a recorded fact even from raw SQL', async () => {
    const scene = await seedScene();
    const playId = await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    await active.query(
      `UPDATE "match_play_events" SET "play_type" = 'drop' WHERE "id" = $1`,
      [playId],
    );
    const rows: { play_type: string }[] = await active.query(
      `SELECT "play_type" FROM "match_play_events" WHERE "id" = $1`,
      [playId],
    );
    expect(rows[0]?.play_type).toBe('point_started');
  });

  it('closes the point stream of a finalized match at the database level', async () => {
    const scene = await seedScene();
    await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    await closePoint(scene, ScoringSide.Us);
    const completed = await transitionMatch.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
      {
        transition: MatchTransition.Complete,
        expectedRecordVersion: scene.recordVersion,
        reason: null,
      },
    );
    await finalizeMatch.execute(scene.actor, scene.teamId, scene.matchId, {
      expectedRecordVersion: completed.recordVersion,
      ourScore: null,
      opponentScore: null,
    });
    await expect(
      startPoint.execute(scene.actor, scene.teamId, scene.matchId, {
        content: {
          operationId: operationId(),
          startingLine: PointStartingLine.Offense,
          lineMembershipIds: scene.members.slice(0, 2),
          pullerMembershipId: null,
          occurredAt: null,
          notes: null,
        },
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.matchFinalized' });
    await expect(
      active.query(
        `INSERT INTO "match_play_events" ("match_id", "team_id", "sequence",
           "operation_id", "request_hash", "play_type", "point_number")
         VALUES ($1, $2, 99, 'raw-op', 'raw-hash', 'goal', 1)`,
        [scene.matchId, scene.teamId],
      ),
    ).rejects.toThrow(/closed/u);
  });

  it('refuses a second open point and a fact with no point open', async () => {
    const scene = await seedScene();
    await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    await expect(
      startPoint.execute(scene.actor, scene.teamId, scene.matchId, {
        content: {
          operationId: operationId(),
          startingLine: PointStartingLine.Defense,
          lineMembershipIds: scene.members.slice(0, 2),
          pullerMembershipId: null,
          occurredAt: null,
          notes: null,
        },
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.pointAlreadyOpen' });
    await closePoint(scene, ScoringSide.Us);
    await expect(
      recordGoal(scene, scene.members[0] ?? '', null),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.pointNotOpen' });
  });

  it('rejects a lineup that breaks a configured constraint', async () => {
    const scene = await seedScene();
    const first = scene.members[0] ?? '';
    await expect(
      startPoint.execute(scene.actor, scene.teamId, scene.matchId, {
        content: {
          operationId: operationId(),
          startingLine: PointStartingLine.Offense,
          lineMembershipIds: [first, first],
          pullerMembershipId: null,
          occurredAt: null,
          notes: null,
        },
      }),
    ).rejects.toMatchObject({ messageKey: 'errors.matches.lineupInvalid' });
  });

  /**
   * The REBUILD-DETERMINISM proof against a real database: two matches are
   * played out with the same facts, one cleanly and one through a mistake plus a
   * compensating correction. Both are projected through the same pure engine and
   * must produce identical team and per-player figures.
   */
  it('rebuilds a corrected stream to the same statistics as a clean one', async () => {
    const clean = await seedScene({}, 3);
    const corrected = await seedScene({}, 3);
    const scorerIndex = 0;
    const assistIndex = 1;

    await openPoint(
      clean,
      PointStartingLine.Offense,
      clean.members.slice(0, 2),
    );
    await recordGoal(
      clean,
      clean.members[scorerIndex] ?? '',
      clean.members[assistIndex] ?? '',
    );
    await closePoint(clean, ScoringSide.Us);

    await openPoint(
      corrected,
      PointStartingLine.Offense,
      corrected.members.slice(0, 2),
    );
    const wrongGoal = await recordGoal(
      corrected,
      corrected.members[assistIndex] ?? '',
      corrected.members[scorerIndex] ?? '',
    );
    await correctPlay.execute(
      corrected.actor,
      corrected.teamId,
      corrected.matchId,
      {
        content: {
          operationId: operationId(),
          playId: wrongGoal,
          reason: 'goal and assist were swapped',
        },
      },
    );
    await recordGoal(
      corrected,
      corrected.members[scorerIndex] ?? '',
      corrected.members[assistIndex] ?? '',
    );
    await closePoint(corrected, ScoringSide.Us);

    const cleanStats = await statistics.getForMatch(
      clean.teamId,
      clean.matchId,
    );
    const correctedStats = await statistics.getForMatch(
      corrected.teamId,
      corrected.matchId,
    );
    expect(correctedStats.team).toEqual(cleanStats.team);
    expect(
      correctedStats.players.map(player => ({
        index: corrected.members.indexOf(player.membershipId),
        pointsPlayed: player.pointsPlayed,
        goals: player.goals,
        assists: player.assists,
        rostered: player.rostered,
      })),
    ).toEqual(
      cleanStats.players.map(player => ({
        index: clean.members.indexOf(player.membershipId),
        pointsPlayed: player.pointsPlayed,
        goals: player.goals,
        assists: player.assists,
        rostered: player.rostered,
      })),
    );
  });

  it('keeps the retracted fact on the stream rather than deleting it', async () => {
    const scene = await seedScene();
    await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    const goalId = await recordGoal(scene, scene.members[0] ?? '', null);
    await recordGoal(scene, scene.members[1] ?? '', null);
    await correctPlay.execute(scene.actor, scene.teamId, scene.matchId, {
      content: {
        operationId: operationId(),
        playId: goalId,
        reason: 'that goal never happened',
      },
    });
    const feed = await playQuery.listForMatch(
      scene.teamId,
      scene.matchId,
      PAGE,
    );
    const original = feed.items.find(item => item.playId === goalId);
    expect(original?.retracted).toBe(true);
    expect(original?.playType).toBe(MatchPlayType.Goal);
    const projected = await statistics.getForMatch(scene.teamId, scene.matchId);
    const retractedScorer = projected.players.find(
      player => player.membershipId === scene.members[0],
    );
    const keptScorer = projected.players.find(
      player => player.membershipId === scene.members[1],
    );
    expect(retractedScorer?.goals).toBe(0);
    expect(keptScorer?.goals).toBe(1);
  });

  it('refuses to retract the same fact twice', async () => {
    const scene = await seedScene();
    await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    const goalId = await recordGoal(scene, scene.members[0] ?? '', null);
    await correctPlay.execute(scene.actor, scene.teamId, scene.matchId, {
      content: {
        operationId: operationId(),
        playId: goalId,
        reason: 'that goal never happened',
      },
    });
    await expect(
      correctPlay.execute(scene.actor, scene.teamId, scene.matchId, {
        content: {
          operationId: operationId(),
          playId: goalId,
          reason: 'retracting it a second time',
        },
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.matches.operationConflict',
    });
  });

  it('reuses the point number after a retracted point start', async () => {
    const scene = await seedScene();
    const startId = await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    await correctPlay.execute(scene.actor, scene.teamId, scene.matchId, {
      content: {
        operationId: operationId(),
        playId: startId,
        reason: 'the wrong line took the field',
      },
    });
    const reopened = await startPoint.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
      {
        content: {
          operationId: operationId(),
          startingLine: PointStartingLine.Defense,
          lineMembershipIds: scene.members.slice(1, 3),
          pullerMembershipId: null,
          occurredAt: null,
          notes: null,
        },
      },
    );
    expect(reopened.pointNumber).toBe(1);
  });

  it('withholds opponent errors as null unless the ruleset approves them', async () => {
    const withheld = await seedScene();
    const approved = await seedScene({
      rulesetKey: 'wfdf-outdoor',
      opponentErrorAttribution: true,
    });
    for (const scene of [withheld, approved]) {
      await openPoint(
        scene,
        PointStartingLine.Defense,
        scene.members.slice(0, 2),
      );
      await recordPlay.execute(scene.actor, scene.teamId, scene.matchId, {
        content: {
          operationId: operationId(),
          playType: MatchPlayType.OpponentDrop,
          primaryMembershipId: scene.members[0] ?? null,
          secondaryMembershipId: null,
          assistState: AssistState.Unknown,
          callahan: false,
          occurredAt: null,
          notes: null,
        },
      });
    }
    const withheldStats = await statistics.getForMatch(
      withheld.teamId,
      withheld.matchId,
    );
    const approvedStats = await statistics.getForMatch(
      approved.teamId,
      approved.matchId,
    );
    expect(withheldStats.team.opponentErrors).toBeNull();
    expect(approvedStats.team.opponentErrors).toBe(1);
  });

  it('publishes the point, event, and projection outbox facts', async () => {
    const scene = await seedScene();
    await openPoint(
      scene,
      PointStartingLine.Offense,
      scene.members.slice(0, 2),
    );
    const goalId = await recordGoal(scene, scene.members[0] ?? '', null);
    await closePoint(scene, ScoringSide.Us);
    await correctPlay.execute(scene.actor, scene.teamId, scene.matchId, {
      content: {
        operationId: operationId(),
        playId: goalId,
        reason: 'the wrong player was credited',
      },
    });
    await rebuild.execute(scene.actor, scene.teamId, scene.matchId);
    expect(await outboxCount(scene.matchId, 'match.point_started.v1')).toBe(1);
    expect(await outboxCount(scene.matchId, 'match.point_completed.v1')).toBe(
      1,
    );
    expect(await outboxCount(scene.matchId, 'match.event_accepted.v1')).toBe(1);
    expect(await outboxCount(scene.matchId, 'match.event_corrected.v1')).toBe(
      1,
    );
    expect(await outboxCount(scene.matchId, 'match.stats_projected.v1')).toBe(
      1,
    );
  });

  it('rebuilds to exactly what the read path derives, writing no totals', async () => {
    const scene = await seedScene();
    await openPoint(
      scene,
      PointStartingLine.Defense,
      scene.members.slice(0, 2),
    );
    await recordGoal(scene, scene.members[0] ?? '', scene.members[1] ?? '');
    await closePoint(scene, ScoringSide.Us);
    const read = await statistics.getForMatch(scene.teamId, scene.matchId);
    const rebuilt = await rebuild.execute(
      scene.actor,
      scene.teamId,
      scene.matchId,
    );
    expect(rebuilt).toEqual(read);
    expect(rebuilt.team.breaks).toBe(1);
    const again = await statistics.getForMatch(scene.teamId, scene.matchId);
    expect(again).toEqual(read);
  });

  it('reports null, not zero, for a match nobody tracked', async () => {
    const scene = await seedScene();
    const projected = await statistics.getForMatch(scene.teamId, scene.matchId);
    expect(projected.lineupsRecorded).toBe(false);
    expect(projected.playsRecorded).toBe(false);
    expect(projected.players).toHaveLength(3);
    for (const player of projected.players) {
      expect(player.pointsPlayed).toBeNull();
      expect(player.goals).toBeNull();
      expect(player.rostered).toBe(true);
    }
  });
});
