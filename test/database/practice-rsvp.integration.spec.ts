import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { PracticeRsvpRepository } from '@modules/practices/infrastructure/practice-rsvp.repository';
import { PracticeRsvpRevisionRepository } from '@modules/practices/infrastructure/practice-rsvp-revision.repository';
import { RsvpMembershipRepository } from '@modules/practices/infrastructure/rsvp-membership.repository';
import {
  RsvpNoteVisibility,
  RsvpSource,
  RsvpStatus,
} from '@modules/practices/model/rsvp.enums';
import type { NewRsvp } from '@modules/practices/model/rsvp.types';
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
  ? 'Practice RSVP integration (PostgreSQL)'
  : `Practice RSVP integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

interface Scope {
  readonly teamId: string;
  readonly seasonId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly memberA: string;
  readonly memberB: string;
}

function newRsvp(
  scope: Scope,
  membershipId: string,
  overrides: Partial<NewRsvp>,
): NewRsvp {
  return {
    id: randomUUID(),
    sessionId: scope.sessionId,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    membershipId,
    userId: scope.userId,
    status: RsvpStatus.Going,
    reasonCategory: null,
    note: null,
    noteVisibility: RsvpNoteVisibility.Coaches,
    source: RsvpSource.Self,
    waitlisted: false,
    respondedAt: NOW,
    createdBy: scope.userId,
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
  const rsvps = new PracticeRsvpRepository();
  const revisions = new PracticeRsvpRevisionRepository();
  const memberships = new RsvpMembershipRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await activeDataSource.undoLastMigration();
      remaining -= 1;
    }
    await activeDataSource.destroy();
  });

  async function seedScope(capacity: number | null): Promise<Scope> {
    const teamId = randomUUID();
    const seasonId = randomUUID();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const memberA = randomUUID();
    const memberB = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name") VALUES ($1, $2, $3)`,
      [teamId, `team-${teamId.slice(0, 8)}`, 'Natives'],
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
              "session_type", "starts_at", "ends_at", "status", "capacity")
       VALUES ($1, $2, $3, 'practice', $4, $5, 'published', $6)`,
      [
        sessionId,
        teamId,
        seasonId,
        '2026-06-05T16:00:00.000Z',
        '2026-06-05T18:00:00.000Z',
        capacity,
      ],
    );
    await activeDataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active'), ($4, $2, NULL, 'active')`,
      [memberA, teamId, userId, memberB],
    );
    return { teamId, seasonId, userId, sessionId, memberA, memberB };
  }

  it('migrates from empty and drops the RSVP schema reversibly', async () => {
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.practice_rsvps') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.practice_rsvps') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('inserts, reads, and version-guards an effective RSVP; duplicate is null', async () => {
    const scope = await seedScope(null);
    const created = await unitOfWork.runInTransaction(scope2 =>
      rsvps.insert(scope2, newRsvp(scope, scope.memberA, {})),
    );
    expect(created?.status).toBe(RsvpStatus.Going);
    expect(created?.version).toBe(1);

    const duplicate = await unitOfWork.runInTransaction(scope2 =>
      rsvps.insert(scope2, newRsvp(scope, scope.memberA, {})),
    );
    expect(duplicate).toBeNull();

    const found = await unitOfWork.runInTransaction(scope2 =>
      rsvps.findBySessionMembership(scope2, scope.sessionId, scope.memberA),
    );
    expect(found?.id).toBe(created?.id);

    const missing = await unitOfWork.runInTransaction(scope2 =>
      rsvps.findBySessionMembership(scope2, scope.sessionId, randomUUID()),
    );
    expect(missing).toBeNull();

    const stale = await unitOfWork.runInTransaction(scope2 =>
      rsvps.update(scope2, {
        id: created?.id ?? '',
        status: RsvpStatus.Maybe,
        reasonCategory: null,
        note: null,
        noteVisibility: RsvpNoteVisibility.Coaches,
        source: RsvpSource.Self,
        waitlisted: false,
        respondedAt: NOW,
        updatedBy: scope.userId,
        expectedVersion: 99,
        now: NOW,
      }),
    );
    expect(stale).toBeNull();

    const updated = await unitOfWork.runInTransaction(scope2 =>
      rsvps.update(scope2, {
        id: created?.id ?? '',
        status: RsvpStatus.Maybe,
        reasonCategory: null,
        note: 'travelling',
        noteVisibility: RsvpNoteVisibility.Team,
        source: RsvpSource.Self,
        waitlisted: false,
        respondedAt: NOW,
        updatedBy: scope.userId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(updated?.status).toBe(RsvpStatus.Maybe);
    expect(updated?.version).toBe(2);
  });

  it('counts confirmed going excluding self and finds the earliest waitlisted', async () => {
    const scope = await seedScope(1);
    await unitOfWork.runInTransaction(async scope2 => {
      await rsvps.insert(scope2, newRsvp(scope, scope.memberA, {}));
      await rsvps.insert(
        scope2,
        newRsvp(scope, scope.memberB, { waitlisted: true, respondedAt: NOW }),
      );
    });

    const confirmed = await unitOfWork.runInTransaction(scope2 =>
      rsvps.countConfirmedGoing(scope2, scope.sessionId, scope.memberB),
    );
    expect(confirmed).toBe(1);

    const waiter = await unitOfWork.runInTransaction(scope2 =>
      rsvps.findEarliestWaitlisted(scope2, scope.sessionId),
    );
    expect(waiter?.membershipId).toBe(scope.memberB);

    const promoted = await unitOfWork.runInTransaction(scope2 =>
      rsvps.promote(scope2, {
        id: waiter?.id ?? '',
        updatedBy: null,
        expectedVersion: waiter?.version ?? 0,
        now: NOW,
      }),
    );
    expect(promoted?.waitlisted).toBe(false);

    const noneLeft = await unitOfWork.runInTransaction(scope2 =>
      rsvps.findEarliestWaitlisted(scope2, scope.sessionId),
    );
    expect(noneLeft).toBeNull();

    const rePromote = await unitOfWork.runInTransaction(scope2 =>
      rsvps.promote(scope2, {
        id: promoted?.id ?? '',
        updatedBy: null,
        expectedVersion: promoted?.version ?? 0,
        now: NOW,
      }),
    );
    expect(rePromote).toBeNull();
  });

  it('projects a privacy-safe summary and paginated participant list', async () => {
    const scope = await seedScope(5);
    await unitOfWork.runInTransaction(async scope2 => {
      await rsvps.insert(scope2, newRsvp(scope, scope.memberA, {}));
      await rsvps.insert(
        scope2,
        newRsvp(scope, scope.memberB, { status: RsvpStatus.NotGoing }),
      );
    });

    const summary = await unitOfWork.runInTransaction(scope2 =>
      rsvps.summary(scope2, scope.sessionId),
    );
    expect(summary).toEqual({
      going: 1,
      waitlisted: 0,
      notGoing: 1,
      maybe: 0,
      noResponse: 0,
    });

    const all = await unitOfWork.runInTransaction(scope2 =>
      rsvps.listParticipants(scope2, scope.sessionId, {
        status: null,
        limit: 20,
        offset: 0,
      }),
    );
    expect(all.total).toBe(2);

    const going = await unitOfWork.runInTransaction(scope2 =>
      rsvps.listParticipants(scope2, scope.sessionId, {
        status: RsvpStatus.Going,
        limit: 20,
        offset: 0,
      }),
    );
    expect(going.total).toBe(1);
    expect(going.items[0]?.membershipId).toBe(scope.memberA);
  });

  it('appends and reads an RSVP revision history oldest-first', async () => {
    const scope = await seedScope(null);
    const created = await unitOfWork.runInTransaction(scope2 =>
      rsvps.insert(scope2, newRsvp(scope, scope.memberA, {})),
    );
    await unitOfWork.runInTransaction(scope2 =>
      revisions.append(scope2, {
        id: randomUUID(),
        rsvpId: created?.id ?? '',
        sessionId: scope.sessionId,
        membershipId: scope.memberA,
        fromStatus: null,
        toStatus: RsvpStatus.Going,
        reasonCategory: null,
        note: null,
        waitlisted: false,
        source: RsvpSource.Self,
        isOverride: false,
        overrideReason: null,
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
    expect(history[0]?.toStatus).toBe(RsvpStatus.Going);
  });

  it('resolves active memberships for self and override writes', async () => {
    const scope = await seedScope(null);
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
    }));
    expect(result.byUser?.id).toBe(scope.memberA);
    expect(result.byUserMissing).toBeNull();
    expect(result.byId?.id).toBe(scope.memberA);
    expect(result.byIdMissing).toBeNull();
  });
});
