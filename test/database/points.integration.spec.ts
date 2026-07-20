import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { AuditRecorderService } from '@modules/platform/application/audit-recorder.service';
import { RecordDomainEventService } from '@modules/platform/application/record-domain-event.service';
import { AuditLogRepository } from '@modules/platform/infrastructure/audit-log.repository';
import { OutboxRepository } from '@modules/platform/infrastructure/outbox.repository';
import { AwardActivityPointsService } from '@modules/points/application/award-activity-points.service';
import { BadgeSyncService } from '@modules/points/application/badge-sync.service';
import { CreateAdjustmentUseCase } from '@modules/points/application/create-adjustment.use-case';
import { LeaderboardDataService } from '@modules/points/application/leaderboard-data.service';
import { LeaderboardQueryService } from '@modules/points/application/leaderboard-query.service';
import { PointsScopeService } from '@modules/points/application/points-scope.service';
import { PointsSummaryService } from '@modules/points/application/points-summary.service';
import { ReverseActivityPointsService } from '@modules/points/application/reverse-activity-points.service';
import { BadgeRepository } from '@modules/points/infrastructure/badge.repository';
import { LeaderboardRepository } from '@modules/points/infrastructure/leaderboard.repository';
import { PointsLedgerRepository } from '@modules/points/infrastructure/points-ledger.repository';
import { PointsRuleRepository } from '@modules/points/infrastructure/points-rule.repository';
import { PointsScopeRepository } from '@modules/points/infrastructure/points-scope.repository';
import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '@modules/points/model/leaderboard.enums';
import type {
  LeaderboardQuery,
  RankedLeaderboardRow,
} from '@modules/points/model/leaderboard.types';
import type { ActivityAwardCommand } from '@modules/points/model/points.types';
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

const NOW = new Date('2026-03-01T12:00:00.000Z');
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
];

const CLOCK = { now: () => NOW, uptime: () => 0 };
const ID_GEN = { generate: () => randomUUID() };

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
  ? 'Points ledger integration (PostgreSQL)'
  : `Points integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const rules = new PointsRuleRepository();
  const ledger = new PointsLedgerRepository();
  const badges = new BadgeRepository();
  const scopeRepo = new PointsScopeRepository();
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
  const badgeSync = new BadgeSyncService(ID_GEN, ledger, badges, events);
  const award = new AwardActivityPointsService(
    CLOCK,
    ID_GEN,
    rules,
    ledger,
    badgeSync,
    audit,
    events,
  );
  const reverse = new ReverseActivityPointsService(
    CLOCK,
    ID_GEN,
    ledger,
    audit,
    events,
  );
  const adjust = new CreateAdjustmentUseCase(
    unitOfWork,
    CLOCK,
    ID_GEN,
    new PointsScopeService(scopeRepo),
    ledger,
    badgeSync,
    new PointsSummaryService(ledger, badges),
    audit,
    events,
  );
  const leaderboardRepo = new LeaderboardRepository();
  const LEADERBOARD_CLOCK = {
    now: () => new Date('2026-03-15T12:00:00.000Z'),
    uptime: () => 0,
  };
  const leaderboard = new LeaderboardQueryService(
    unitOfWork,
    LEADERBOARD_CLOCK,
    new PointsScopeService(scopeRepo),
    leaderboardRepo,
    new LeaderboardDataService(leaderboardRepo),
  );

  function leaderboardQuery(
    overrides: Partial<LeaderboardQuery> = {},
  ): LeaderboardQuery {
    return {
      period: LeaderboardPeriod.AllTime,
      tieMode: LeaderboardTieMode.Competition,
      cohort: LeaderboardCohort.Active,
      seasonId: null,
      category: null,
      limit: 100,
      offset: 0,
      ...overrides,
    };
  }

  function rankFor(
    rows: readonly RankedLeaderboardRow[],
    membershipId: string,
  ): number | undefined {
    return rows.find(row => row.membershipId === membershipId)?.rank;
  }

  async function addMembership(teamId: string): Promise<string> {
    const userId = randomUUID();
    const membershipId = randomUUID();
    await active.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `user-${userId}@example.test`],
    );
    await active.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [membershipId, teamId, userId],
    );
    return membershipId;
  }

  async function insertLedger(
    teamId: string,
    membershipId: string,
    amount: number,
    createdAtIso: string,
  ): Promise<void> {
    const id = randomUUID();
    await active.query(
      `INSERT INTO "points_ledger"
        ("id", "team_id", "membership_id", "entry_type", "amount",
         "source_type", "activity_category", "idempotency_key", "effective_on",
         "created_at")
       VALUES ($1, $2, $3, 'award', $4, 'manual', 'throwing', $5, $6, $7)`,
      [
        id,
        teamId,
        membershipId,
        amount,
        `k-${id}`,
        createdAtIso.slice(0, 10),
        createdAtIso,
      ],
    );
  }

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
    userId: string;
    throwingTypeId: string;
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
    const type = await active.query(
      `SELECT "id" FROM "activity_types" WHERE "category" = 'throwing' LIMIT 1`,
    );
    return { teamId, membershipId, userId, throwingTypeId: type[0].id };
  }

  async function publishRule(teamId: string): Promise<void> {
    await active.query(
      `INSERT INTO "points_rules"
        ("id", "team_id", "rule_key", "version", "name", "status", "point_entries")
       VALUES ($1, $2, 'team_external', 1, 'Team external', 'published', $3::jsonb)`,
      [
        randomUUID(),
        teamId,
        JSON.stringify([
          {
            activityCategory: 'throwing',
            points: 4,
            dailyCap: 1,
            cooldownDays: null,
          },
        ]),
      ],
    );
  }

  function awardCommand(
    scope: {
      teamId: string;
      membershipId: string;
      userId: string;
      throwingTypeId: string;
    },
    submissionId: string,
    performedOn = '2026-03-01',
  ): ActivityAwardCommand {
    return {
      submissionId,
      teamId: scope.teamId,
      seasonId: null,
      membershipId: scope.membershipId,
      activityTypeId: scope.throwingTypeId,
      performedOn,
      actorUserId: scope.userId,
    };
  }

  function total(membershipId: string): Promise<number> {
    return unitOfWork.runInTransaction(tx => ledger.totalFor(tx, membershipId));
  }

  it('has seeded the external-training candidate as a global DRAFT', async () => {
    const rows = await active.query(
      `SELECT "status", "team_id" FROM "points_rules"
        WHERE "id" = '40200000-0000-4000-9000-000000000001'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('draft');
    expect(rows[0].team_id).toBeNull();
  });

  it('refuses any UPDATE or DELETE on a ledger entry (append-only guard)', async () => {
    const scope = await seedScope();
    const entryId = randomUUID();
    await active.query(
      `INSERT INTO "points_ledger"
        ("id", "team_id", "membership_id", "entry_type", "amount", "source_type",
         "idempotency_key", "effective_on")
       VALUES ($1, $2, $3, 'manual_adjustment', 5, 'manual', $4, '2026-03-01')`,
      [entryId, scope.teamId, scope.membershipId, `k-${entryId}`],
    );
    await expect(
      active.query(`UPDATE "points_ledger" SET "amount" = 9 WHERE "id" = $1`, [
        entryId,
      ]),
    ).rejects.toThrow(/append-only/u);
    await expect(
      active.query(`DELETE FROM "points_ledger" WHERE "id" = $1`, [entryId]),
    ).rejects.toThrow(/append-only/u);
  });

  it('awards the published throwing value and projects the total', async () => {
    const scope = await seedScope();
    await publishRule(scope.teamId);
    await unitOfWork.runInTransaction(tx =>
      award.awardForApproval(tx, awardCommand(scope, randomUUID())),
    );
    expect(await total(scope.membershipId)).toBe(4);
  });

  it('is idempotent — a duplicate award of the same submission adds no row', async () => {
    const scope = await seedScope();
    await publishRule(scope.teamId);
    const command = awardCommand(scope, randomUUID());
    await unitOfWork.runInTransaction(tx =>
      award.awardForApproval(tx, command),
    );
    await unitOfWork.runInTransaction(tx =>
      award.awardForApproval(tx, command),
    );
    const rows = await active.query(
      `SELECT COUNT(*)::int AS "count" FROM "points_ledger"
        WHERE "membership_id" = $1 AND "entry_type" = 'award'`,
      [scope.membershipId],
    );
    expect(rows[0].count).toBe(1);
    expect(await total(scope.membershipId)).toBe(4);
  });

  it('awards exactly once under a concurrent award race', async () => {
    const scope = await seedScope();
    await publishRule(scope.teamId);
    const command = awardCommand(scope, randomUUID());
    await Promise.allSettled([
      unitOfWork.runInTransaction(tx => award.awardForApproval(tx, command)),
      unitOfWork.runInTransaction(tx => award.awardForApproval(tx, command)),
    ]);
    const rows = await active.query(
      `SELECT COUNT(*)::int AS "count" FROM "points_ledger"
        WHERE "source_id" = $1 AND "entry_type" = 'award'`,
      [command.submissionId],
    );
    expect(rows[0].count).toBe(1);
  });

  it('withholds a second same-day throwing award under the daily cap', async () => {
    const scope = await seedScope();
    await publishRule(scope.teamId);
    await unitOfWork.runInTransaction(tx =>
      award.awardForApproval(tx, awardCommand(scope, randomUUID())),
    );
    await unitOfWork.runInTransaction(tx =>
      award.awardForApproval(tx, awardCommand(scope, randomUUID())),
    );
    expect(await total(scope.membershipId)).toBe(4);
  });

  it('reverses exactly, compensating an approved award to a zero total', async () => {
    const scope = await seedScope();
    await publishRule(scope.teamId);
    const command = awardCommand(scope, randomUUID());
    await unitOfWork.runInTransaction(tx =>
      award.awardForApproval(tx, command),
    );
    await unitOfWork.runInTransaction(tx =>
      reverse.reverseForCorrection(tx, {
        submissionId: command.submissionId,
        teamId: scope.teamId,
        membershipId: scope.membershipId,
        actorUserId: scope.userId,
      }),
    );
    expect(await total(scope.membershipId)).toBe(0);
  });

  it('records an audited manual adjustment and re-projects the total', async () => {
    const scope = await seedScope();
    const actor = { userId: scope.userId, email: 'a@x.test', roles: [] };
    const summary = await adjust.execute(
      actor,
      scope.teamId,
      scope.membershipId,
      {
        amount: 12,
        reason: 'seed correction',
        operationKey: `op-${randomUUID()}`,
      },
    );
    expect(summary.total).toBe(12);
    const auditRows = await active.query(
      `SELECT COUNT(*)::int AS "count" FROM "audit_log"
        WHERE "action" = 'points.adjusted'`,
    );
    expect(auditRows[0].count).toBeGreaterThanOrEqual(1);
  });

  it('awards a badge when crossing an active threshold; the broken tier is never active', async () => {
    const scope = await seedScope();
    const actor = { userId: scope.userId, email: 'a@x.test', roles: [] };
    await active.query(
      `INSERT INTO "badge_definitions"
        ("id", "team_id", "badge_key", "name", "threshold", "status")
       VALUES ($1, $2, 'century', 'Century', 100, 'active')`,
      [randomUUID(), scope.teamId],
    );
    await adjust.execute(actor, scope.teamId, scope.membershipId, {
      amount: 150,
      reason: 'reconciliation',
      operationKey: `op-${randomUUID()}`,
    });
    const earned = await active.query(
      `SELECT "badge_key" FROM "player_badges" WHERE "membership_id" = $1`,
      [scope.membershipId],
    );
    expect(earned.map((row: { badge_key: string }) => row.badge_key)).toContain(
      'century',
    );
    const activeDefs = await unitOfWork.runInTransaction(tx =>
      badges.listActive(tx, scope.teamId),
    );
    expect(activeDefs.some(def => def.badgeKey === 'broken_tier')).toBe(false);
  });

  it('lands a Cairo month-boundary award in the correct month (golden)', async () => {
    const scope = await seedScope();
    const other = await addMembership(scope.teamId);
    // 22:30Z on 28 Feb is 00:30 on 1 Mar in Cairo (+2) -> inside March.
    await insertLedger(
      scope.teamId,
      scope.membershipId,
      5,
      '2026-02-28T22:30:00.000Z',
    );
    // 21:30Z on 28 Feb is 23:30 on 28 Feb in Cairo -> outside March.
    await insertLedger(scope.teamId, other, 5, '2026-02-28T21:30:00.000Z');
    const page = await leaderboard.teamLeaderboard(
      scope.teamId,
      leaderboardQuery({ period: LeaderboardPeriod.Monthly }),
    );
    const rows = new Map(page.items.map(row => [row.membershipId, row.total]));
    expect(rows.get(scope.membershipId)).toBe(5);
    expect(rows.get(other)).toBe(0);
  });

  it('moves rank when an award is reversed (golden)', async () => {
    const scope = await seedScope();
    const other = await addMembership(scope.teamId);
    await insertLedger(
      scope.teamId,
      scope.membershipId,
      10,
      '2026-03-01T10:00:00.000Z',
    );
    await insertLedger(scope.teamId, other, 6, '2026-03-01T10:00:00.000Z');
    const before = await leaderboard.teamLeaderboard(
      scope.teamId,
      leaderboardQuery(),
    );
    expect(rankFor(before.items, scope.membershipId)).toBe(1);
    expect(rankFor(before.items, other)).toBe(2);

    await insertLedger(
      scope.teamId,
      scope.membershipId,
      -10,
      '2026-03-02T10:00:00.000Z',
    );
    const after = await leaderboard.teamLeaderboard(
      scope.teamId,
      leaderboardQuery(),
    );
    expect(rankFor(after.items, other)).toBe(1);
    expect(rankFor(after.items, scope.membershipId)).toBe(2);
  });
});
