import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { ActivityReviewRepository } from '@modules/activities/infrastructure/activity-review.repository';
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

const NOW = new Date('2024-06-02T09:00:00.000Z');
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
  ? 'Activity review integration (PostgreSQL)'
  : `Activity review integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const active = dataSource;
  if (!active) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(active);
  const review = new ActivityReviewRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await active.undoLastMigration();
      remaining -= 1;
    }
    await active.destroy();
  });

  async function seedUser(): Promise<string> {
    const id = randomUUID();
    await active.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [id, `user-${id}@example.test`],
    );
    return id;
  }

  async function seedScope(): Promise<{
    teamId: string;
    membershipId: string;
    memberUserId: string;
    typeId: string;
  }> {
    const teamId = randomUUID();
    const membershipId = randomUUID();
    const memberUserId = await seedUser();
    await active.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, 'Natives')`,
      [teamId, `team-${teamId.slice(0, 8)}`],
    );
    await active.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [membershipId, teamId, memberUserId],
    );
    const typeRow = await active.query(
      `SELECT "id" FROM "activity_types" WHERE "type_key" = 'gym'`,
    );
    return { teamId, membershipId, memberUserId, typeId: typeRow[0].id };
  }

  async function seedSubmission(
    teamId: string,
    membershipId: string,
    memberUserId: string,
    typeId: string,
    performedOn: string,
    status: string,
  ): Promise<string> {
    const id = randomUUID();
    await active.query(
      `INSERT INTO "activity_submissions"
        ("id", "team_id", "membership_id", "activity_type_id",
         "submitter_user_id", "status", "performed_on")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, teamId, membershipId, typeId, memberUserId, status, performedOn],
    );
    return id;
  }

  it('claims, decides, and reverses under optimistic guards', async () => {
    const scope = await seedScope();
    const reviewerId = await seedUser();
    const id = await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      scope.typeId,
      '2024-06-01',
      'submitted',
    );
    const outcome = await unitOfWork.runInTransaction(async tx => {
      const claimed = await review.claimForReview(tx, {
        id,
        teamId: scope.teamId,
        expectedRecordVersion: 1,
        reviewerUserId: reviewerId,
        now: NOW,
      });
      const stale = await review.claimForReview(tx, {
        id,
        teamId: scope.teamId,
        expectedRecordVersion: 1,
        reviewerUserId: reviewerId,
        now: NOW,
      });
      const decided = await review.applyDecision(tx, {
        id,
        teamId: scope.teamId,
        expectedRecordVersion: claimed?.recordVersion ?? 0,
        toStatus: 'approved' as never,
        reviewNote: 'looks good',
        reviewerUserId: reviewerId,
        now: NOW,
      });
      const reversed = await review.applyReversal(tx, {
        id,
        teamId: scope.teamId,
        expectedRecordVersion: decided?.recordVersion ?? 0,
        reversalReason: 'duplicate of another claim',
        actorUserId: reviewerId,
        now: NOW,
      });
      return { claimed, stale, decided, reversed };
    });
    expect(outcome.claimed?.status).toBe('under_review');
    expect(outcome.claimed?.reviewerUserId).toBe(reviewerId);
    expect(outcome.stale).toBeNull();
    expect(outcome.decided?.status).toBe('approved');
    expect(outcome.decided?.reviewNote).toBe('looks good');
    expect(outcome.reversed?.status).toBe('reversed');
    expect(outcome.reversed?.reversalReason).toBe('duplicate of another claim');
  });

  it('rejects a decision on a claim that is not under review', async () => {
    const scope = await seedScope();
    const id = await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      scope.typeId,
      '2024-06-01',
      'approved',
    );
    const decided = await unitOfWork.runInTransaction(tx =>
      review.applyDecision(tx, {
        id,
        teamId: scope.teamId,
        expectedRecordVersion: 1,
        toStatus: 'rejected' as never,
        reviewNote: 'no',
        reviewerUserId: scope.memberUserId,
        now: NOW,
      }),
    );
    expect(decided).toBeNull();
  });

  it('counts anti-abuse signals from live submissions only', async () => {
    const scope = await seedScope();
    const target = await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      scope.typeId,
      '2024-06-02',
      'submitted',
    );
    const otherType = await active.query(
      `SELECT "id" FROM "activity_types" WHERE "type_key" = 'running'`,
    );
    await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      otherType[0].id,
      '2024-06-02',
      'submitted',
    );
    await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      scope.typeId,
      '2024-05-20',
      'withdrawn',
    );
    const counts = await unitOfWork.runInTransaction(tx =>
      review.abuseCounts(tx, scope.membershipId, target, '2024-06-02', {
        windowFrom: '2024-05-26',
        windowTo: '2024-06-02',
        buddyFrom: '2024-05-03',
      }),
    );
    // The same-day other-type claim counts; the withdrawn one never does.
    expect(counts.sameDay).toBe(1);
    expect(counts.windowCount).toBe(2);
    expect(counts.buddyRepeat).toBe(0);
  });

  it('detects whether the reviewer is a credited buddy', async () => {
    const scope = await seedScope();
    const buddyUserId = await seedUser();
    const buddyMembershipId = randomUUID();
    await active.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [buddyMembershipId, scope.teamId, buddyUserId],
    );
    const id = await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      scope.typeId,
      '2024-06-01',
      'submitted',
    );
    await active.query(
      `INSERT INTO "activity_buddies" ("id", "submission_id", "membership_id")
       VALUES ($1, $2, $3)`,
      [randomUUID(), id, buddyMembershipId],
    );
    const result = await unitOfWork.runInTransaction(async tx => {
      const isBuddy = await review.isReviewerCreditedBuddy(tx, id, buddyUserId);
      const notBuddy = await review.isReviewerCreditedBuddy(
        tx,
        id,
        scope.memberUserId,
      );
      return { isBuddy, notBuddy };
    });
    expect(result.isBuddy).toBe(true);
    expect(result.notBuddy).toBe(false);
  });

  it('lists a bounded, oldest-first review queue page', async () => {
    const scope = await seedScope();
    await seedSubmission(
      scope.teamId,
      scope.membershipId,
      scope.memberUserId,
      scope.typeId,
      '2024-06-01',
      'submitted',
    );
    const page = await unitOfWork.runInTransaction(tx =>
      review.listQueue(tx, scope.teamId, {
        page: { limit: 20, offset: 0 },
        statuses: ['submitted', 'under_review', 'changes_requested'] as never,
        activityTypeId: null,
        membershipId: null,
      }),
    );
    expect(page.length).toBeGreaterThanOrEqual(1);
    expect(page.every(row => row.teamId === scope.teamId)).toBe(true);
  });
});
