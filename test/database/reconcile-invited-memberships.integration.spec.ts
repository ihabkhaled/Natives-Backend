import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { runInvitedMembershipReconciliation } from '@app/database/seeds/reconcile-invited-memberships';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import type { DatabaseConfig } from '@config/config.types';
import { NodeEnv, Role } from '@shared/enums';
import { DataSource, type QueryRunner } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';
import { InvitationsTeamScope1724800000000 } from '../../src/database/migrations/1724800000000-invitations-team-scope';
import { InvitationTeamRole1725100000000 } from '../../src/database/migrations/1725100000000-invitation-team-role';

const TEST_DB_CONFIG: DatabaseConfig = {
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

interface MembershipRow {
  readonly user_id: string | null;
  readonly status: string;
}

const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  InvitationsTeamScope1724800000000,
  InvitationTeamRole1725100000000,
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
    return dataSource;
  } catch {
    return null;
  }
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Invited-membership reconciliation (PostgreSQL)'
  : `Invited-membership reconciliation (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

/**
 * The reconciliation runs hand-written SQL against the real schema, so the
 * only verification that means anything is running it against real
 * PostgreSQL: a lateral subquery that parses fine in a mock proves nothing.
 */
describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }

  beforeAll(async () => {
    await activeDataSource.runMigrations();
  });

  // One `undoLastMigration` per entry in MIGRATIONS: TypeORM reverses by
  // application order, not by class, so the count is what matters.
  afterAll(async () => {
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  async function seedTeam(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name", "status")
       VALUES ($1, $2, 'Natives', 'active')`,
      [id, `t-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function seedUser(email: string): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, $3, 'active')`,
      [id, email, Role.User],
    );
    return id;
  }

  /** A roster row written the way the defective invite flow wrote them. */
  async function seedEmaillessMembership(teamId: string): Promise<string> {
    const membershipId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, NULL, 'invited')`,
      [membershipId, teamId],
    );
    await activeDataSource.query(
      `INSERT INTO "member_profiles" ("id", "membership_id", "team_id",
              "full_name", "email")
       VALUES ($1, $2, $3, 'Stranded Recruit', NULL)`,
      [randomUUID(), membershipId, teamId],
    );
    return membershipId;
  }

  async function seedInvitation(
    teamId: string,
    email: string,
    status: string,
    roleKey: string,
  ): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "invitations" ("id", "email", "token_hash", "role", "status",
              "team_id", "team_role_key", "expires_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '7 days')`,
      [id, email, randomUUID(), Role.User, status, teamId, roleKey],
    );
    return id;
  }

  async function seedMemberRole(): Promise<string> {
    const rows = await selectRows<{ id: string }>(
      `SELECT "id" FROM "roles" WHERE "key" = 'MEMBER'`,
      [],
    );
    const existing = rows[0];
    if (existing !== undefined) {
      return existing.id;
    }
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "roles" ("id", "key", "display_name") VALUES ($1, 'MEMBER', 'Member')`,
      [id],
    );
    return id;
  }

  /** `DataSource.query` is untyped; name the row shape once at the call site. */
  async function selectRows<TRow>(
    sql: string,
    parameters: readonly unknown[],
  ): Promise<readonly TRow[]> {
    const rows: readonly TRow[] = await activeDataSource.query(sql, [
      ...parameters,
    ]);
    return rows;
  }

  async function withRunner<T>(
    run: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = activeDataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      return await run(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  it('runs its detection SQL against the real schema and finds nothing when clean', async () => {
    const result = await withRunner(queryRunner =>
      runInvitedMembershipReconciliation(queryRunner, false),
    );

    expect(result.orphans).toEqual([]);
    expect(result.applied).toBe(false);
  });

  it('restores the address for a pending invitation without touching the membership', async () => {
    const teamId = await seedTeam();
    const membershipId = await seedEmaillessMembership(teamId);
    await seedInvitation(
      teamId,
      'pending.recruit@example.test',
      'pending',
      'MEMBER',
    );

    await withRunner(queryRunner =>
      runInvitedMembershipReconciliation(queryRunner, true),
    );

    const profiles = await selectRows<{ email: string | null }>(
      `SELECT "email" FROM "member_profiles" WHERE "membership_id" = $1`,
      [membershipId],
    );
    const memberships = await selectRows<MembershipRow>(
      `SELECT "user_id", "status" FROM "memberships" WHERE "id" = $1`,
      [membershipId],
    );

    expect(profiles[0]?.email).toBe('pending.recruit@example.test');
    // Still unlinked and invited: the ordinary accept path does that work.
    expect(memberships[0]?.user_id).toBeNull();
    expect(memberships[0]?.status).toBe('invited');
  });

  it('links, activates and grants for an invitation that was already accepted', async () => {
    await seedMemberRole();
    const teamId = await seedTeam();
    const membershipId = await seedEmaillessMembership(teamId);
    const userId = await seedUser('stranded@example.test');
    await seedInvitation(teamId, 'stranded@example.test', 'accepted', 'MEMBER');

    const result = await withRunner(queryRunner =>
      runInvitedMembershipReconciliation(queryRunner, true),
    );

    const memberships = await selectRows<MembershipRow>(
      `SELECT "user_id", "status" FROM "memberships" WHERE "id" = $1`,
      [membershipId],
    );
    const assignments = await selectRows<{ count: number }>(
      `SELECT count(*)::int AS "count" FROM "user_role_assignments"
        WHERE "user_id" = $1 AND "team_id" = $2 AND "revoked_at" IS NULL`,
      [userId, teamId],
    );

    expect(result.repaired).toHaveLength(1);
    expect(memberships[0]?.user_id).toBe(userId);
    expect(memberships[0]?.status).toBe('active');
    expect(assignments[0]?.count).toBe(1);
  });

  /**
   * The inverse ambiguity, and the dangerous one: one candidate membership,
   * two invitations wanting it. Both name the same row. Repairing either would
   * leave the other holding an invitation with nothing to link — and, before
   * the count guard existed, would still have granted that person a team role.
   */
  it('declines a team where two invitations compete for one membership', async () => {
    await seedMemberRole();
    const teamId = await seedTeam();
    await seedEmaillessMembership(teamId);
    const firstUser = await seedUser('rival.one@example.test');
    await seedUser('rival.two@example.test');
    await seedInvitation(
      teamId,
      'rival.one@example.test',
      'accepted',
      'MEMBER',
    );
    await seedInvitation(
      teamId,
      'rival.two@example.test',
      'accepted',
      'MEMBER',
    );

    const result = await withRunner(queryRunner =>
      runInvitedMembershipReconciliation(queryRunner, true),
    );

    const rivals = result.orphans.filter(orphan =>
      orphan.email.startsWith('rival.'),
    );
    const assignments = await selectRows<{ count: number }>(
      `SELECT count(*)::int AS "count" FROM "user_role_assignments"
        WHERE "user_id" = $1 AND "team_id" = $2 AND "revoked_at" IS NULL`,
      [firstUser, teamId],
    );

    expect(rivals).toHaveLength(2);
    expect(rivals.every(orphan => orphan.verdict === 'ambiguous')).toBe(true);
    expect(result.repaired).toEqual([]);
    // The critical assertion: no role was granted to anybody.
    expect(assignments[0]?.count).toBe(0);
  });

  /**
   * Which membership belongs to an invitation is the one thing inferred. With
   * two email-less candidates in the team, guessing would attach a person to a
   * stranger's roster record, so the repair must decline.
   */
  it('declines to guess when a team holds more than one email-less membership', async () => {
    const teamId = await seedTeam();
    await seedEmaillessMembership(teamId);
    await seedEmaillessMembership(teamId);
    await seedInvitation(teamId, 'ambiguous@example.test', 'pending', 'MEMBER');

    const result = await withRunner(queryRunner =>
      runInvitedMembershipReconciliation(queryRunner, true),
    );

    const ambiguous = result.orphans.filter(
      orphan => orphan.email === 'ambiguous@example.test',
    );
    expect(ambiguous[0]?.verdict).toBe('ambiguous');
    expect(ambiguous[0]?.candidateCount).toBe(2);
    expect(result.repaired).toEqual([]);
  });
});
