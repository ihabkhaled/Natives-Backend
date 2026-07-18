import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { findJerseyConflict } from '@modules/members/domain/jersey.policy';
import { MediaAssetRepository } from '@modules/members/infrastructure/media-asset.repository';
import { MemberAliasRepository } from '@modules/members/infrastructure/member-alias.repository';
import { MemberProfileRepository } from '@modules/members/infrastructure/member-profile.repository';
import { MembershipRepository } from '@modules/members/infrastructure/membership.repository';
import { StatusEventRepository } from '@modules/members/infrastructure/status-event.repository';
import { TeamScopeRepository } from '@modules/members/infrastructure/team-scope.repository';
import {
  AliasSource,
  MediaPurpose,
  MediaScanStatus,
  MembershipStatus,
} from '@modules/members/model/members.enums';
import { NodeEnv, Role } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';

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
  ? 'Members integration (PostgreSQL)'
  : `Members integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const memberships = new MembershipRepository();
  const profiles = new MemberProfileRepository();
  const aliases = new MemberAliasRepository();
  const media = new MediaAssetRepository();
  const events = new StatusEventRepository();
  const teamScope = new TeamScopeRepository();

  afterAll(async () => {
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  async function seedUser(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [id, `user-${id}@example.test`, Role.Admin],
    );
    return id;
  }

  async function seedTeam(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name", "status")
       VALUES ($1, $2, 'Natives', 'active')`,
      [id, `t-${id.slice(0, 8)}`],
    );
    return id;
  }

  function baseProfile() {
    return {
      fullName: 'Ahmed Hassan',
      preferredName: 'Ammar',
      fullNameAr: 'أحمد',
      nickname: 'Speedy',
      email: null,
      phone: null,
      gender: null,
      division: 'open',
      positions: ['handler'],
      jerseyNumber: null as number | null,
      jerseySize: null,
      heightCm: null as number | null,
      weightKg: null,
      dateOfBirth: '2000-01-15',
    };
  }

  async function createMember(
    teamId: string,
    actorId: string,
    userId: string | null,
    jerseyNumber: number | null,
  ): Promise<string> {
    return unitOfWork.runInTransaction(async scope => {
      const membership = await memberships.insert(scope, {
        id: randomUUID(),
        teamId,
        seasonId: null,
        userId,
        status: MembershipStatus.Active,
        statusEffectiveAt: NOW,
        createdBy: actorId,
        now: NOW,
      });
      await profiles.insert(scope, {
        id: randomUUID(),
        membershipId: membership.id,
        teamId,
        profile: { ...baseProfile(), jerseyNumber },
        createdBy: actorId,
        now: NOW,
      });
      return membership.id;
    });
  }

  it('migrates from empty and drops the members schema reversibly', async () => {
    await activeDataSource.runMigrations();
    const present = await activeDataSource.query(
      `SELECT to_regclass('public.memberships') AS relation`,
    );
    expect(present[0].relation).not.toBeNull();

    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.memberships') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('persists a membership + profile, reads DOB and preserves null measurements', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const membershipId = await createMember(teamId, actorId, actorId, 7);

    const record = await unitOfWork.runInTransaction(async scope => {
      const membership = await memberships.findById(
        scope,
        teamId,
        membershipId,
      );
      const profile = await profiles.findByMembershipId(scope, membershipId);
      return { membership, profile };
    });
    expect(record.membership?.status).toBe(MembershipStatus.Active);
    expect(record.membership?.joinedAt).toEqual(NOW);
    expect(record.profile?.dateOfBirth).toBe('2000-01-15');
    expect(record.profile?.heightCm).toBeNull();
    expect(record.profile?.jerseyNumber).toBe(7);
  });

  it('reports scoped team existence for the invite guard', async () => {
    const teamId = await seedTeam();
    const result = await unitOfWork.runInTransaction(async scope => ({
      real: await teamScope.activeTeamExists(scope, teamId),
      fake: await teamScope.activeTeamExists(scope, randomUUID()),
    }));
    expect(result.real).toBe(true);
    expect(result.fake).toBe(false);
  });

  it('enforces optimistic concurrency on a status change', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const membershipId = await createMember(teamId, actorId, actorId, null);

    const stale = await unitOfWork.runInTransaction(scope =>
      memberships.applyStatusChange(scope, {
        id: membershipId,
        toStatus: MembershipStatus.Suspended,
        reason: 'test',
        statusEffectiveAt: NOW,
        joinedAt: NOW,
        leftAt: null,
        anonymizedAt: null,
        updatedBy: actorId,
        expectedVersion: 99,
        now: NOW,
      }),
    );
    expect(stale).toBeNull();

    const updated = await unitOfWork.runInTransaction(scope =>
      memberships.applyStatusChange(scope, {
        id: membershipId,
        toStatus: MembershipStatus.Suspended,
        reason: 'test',
        statusEffectiveAt: NOW,
        joinedAt: NOW,
        leftAt: null,
        anonymizedAt: null,
        updatedBy: actorId,
        expectedVersion: 1,
        now: NOW,
      }),
    );
    expect(updated?.status).toBe(MembershipStatus.Suspended);
    expect(updated?.version).toBe(2);
  });

  it('scans active jerseys within the team scope', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    await createMember(teamId, actorId, actorId, 5);
    const secondId = await createMember(teamId, actorId, null, 9);

    const reservations = await unitOfWork.runInTransaction(scope =>
      profiles.listActiveJerseys(scope, teamId, null, 1000),
    );
    expect(reservations.map(r => r.jerseyNumber).sort()).toEqual([5, 9]);
    expect(findJerseyConflict(reservations, 5, secondId)).not.toBeNull();
    expect(findJerseyConflict(reservations, 11, secondId)).toBeNull();
  });

  it('enforces scoped active-alias uniqueness at the database', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const membershipId = await createMember(teamId, actorId, actorId, null);

    await unitOfWork.runInTransaction(scope =>
      aliases.insert(scope, {
        id: randomUUID(),
        membershipId,
        teamId,
        alias: 'Speedy',
        normalizedAlias: 'speedy',
        source: AliasSource.Import,
        createdBy: actorId,
        now: NOW,
      }),
    );

    await expect(
      unitOfWork.runInTransaction(scope =>
        aliases.insert(scope, {
          id: randomUUID(),
          membershipId,
          teamId,
          alias: 'speedy',
          normalizedAlias: 'speedy',
          source: AliasSource.Manual,
          createdBy: actorId,
          now: NOW,
        }),
      ),
    ).rejects.toThrow();

    const listed = await unitOfWork.runInTransaction(scope =>
      aliases.listByMembership(scope, membershipId, 200),
    );
    expect(listed).toHaveLength(1);
  });

  it('appends and lists an immutable status-history timeline', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const membershipId = await createMember(teamId, actorId, actorId, null);

    await unitOfWork.runInTransaction(scope =>
      events.append(scope, {
        id: randomUUID(),
        membershipId,
        fromStatus: MembershipStatus.Active,
        toStatus: MembershipStatus.Suspended,
        reason: 'discipline',
        actorUserId: actorId,
        effectiveAt: NOW,
        now: NOW,
      }),
    );
    const history = await unitOfWork.runInTransaction(scope =>
      events.listByMembership(scope, membershipId, 200),
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.toStatus).toBe(MembershipStatus.Suspended);
  });

  it('stores media metadata and transitions the scan state; redaction clears PII', async () => {
    const actorId = await seedUser();
    const teamId = await seedTeam();
    const membershipId = await createMember(teamId, actorId, actorId, 3);

    const asset = await unitOfWork.runInTransaction(scope =>
      media.insert(scope, {
        id: randomUUID(),
        teamId,
        membershipId,
        purpose: MediaPurpose.Avatar,
        storageKey: `members/${teamId}/${membershipId}/a`,
        contentType: 'image/png',
        byteSize: 2048,
        width: 256,
        height: 256,
        createdBy: actorId,
        now: NOW,
      }),
    );
    expect(asset.scanStatus).toBe(MediaScanStatus.Pending);

    const scanned = await unitOfWork.runInTransaction(scope =>
      media.updateScanStatus(scope, asset.id, MediaScanStatus.Clean),
    );
    expect(scanned?.scanStatus).toBe(MediaScanStatus.Clean);

    await unitOfWork.runInTransaction(async scope => {
      await profiles.updateAvatar(scope, membershipId, asset.id, actorId, NOW);
      await profiles.redact(scope, {
        membershipId,
        redactedName: 'Former member',
        updatedBy: actorId,
        now: NOW,
      });
      await aliases.softDeleteAllForMembership(scope, membershipId, NOW);
    });

    const redacted = await unitOfWork.runInTransaction(scope =>
      profiles.findByMembershipId(scope, membershipId),
    );
    expect(redacted?.fullName).toBe('Former member');
    expect(redacted?.dateOfBirth).toBeNull();
    expect(redacted?.jerseyNumber).toBeNull();
    expect(redacted?.avatarMediaId).toBeNull();
    expect(redacted?.positions).toEqual([]);
  });
});
