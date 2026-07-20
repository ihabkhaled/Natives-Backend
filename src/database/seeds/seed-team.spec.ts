import { MembershipStatus } from '@modules/members';
import { SeasonStatus } from '@modules/teams';
import { RbacRole } from '@shared/enums';
import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { SEED_TEAM_KEY, TEAM_SEED_DEFINITION } from './seed.constants';
import { computeSeedChecksum } from './seed-checksum';
import { createSeedTeamSeeder, seedTeam } from './seed-team';

const ADMIN_EMAIL = 'admin@example.test';
const ADMIN_ID = 'user-1';
const TEAM_ID = 'team-1';
const SEASON_ID = 'season-1';
const MEMBERSHIP_ID = 'membership-1';
const ROLE_ID = 'role-1';
const ASSIGNMENT_ID = 'assignment-1';

interface HarnessOptions {
  readonly adminMissing?: boolean;
  readonly teamExists?: boolean;
  readonly seasonExists?: boolean;
  readonly membershipExists?: boolean;
  readonly assignmentExists?: boolean;
  readonly roleExists?: boolean;
  readonly emptyInsert?: string;
}

function rowsFor(exists: boolean | undefined, id: string): { id: string }[] {
  return exists === true ? [{ id }] : [];
}

function insertRows(
  options: HarnessOptions,
  table: string,
  id: string,
): { id: string }[] {
  return options.emptyInsert === table ? [] : [{ id }];
}

function buildQueryRunner(options: HarnessOptions = {}) {
  const query = vi.fn((sql: string) => {
    if (sql.includes('FROM "users"')) {
      return Promise.resolve(
        options.adminMissing === true ? [] : [{ id: ADMIN_ID }],
      );
    }
    if (sql.includes('FROM "teams"')) {
      return Promise.resolve(rowsFor(options.teamExists, TEAM_ID));
    }
    if (sql.includes('INSERT INTO "teams"')) {
      return Promise.resolve(insertRows(options, 'teams', TEAM_ID));
    }
    if (sql.includes('FROM "seasons"')) {
      return Promise.resolve(rowsFor(options.seasonExists, SEASON_ID));
    }
    if (sql.includes('INSERT INTO "seasons"')) {
      return Promise.resolve(insertRows(options, 'seasons', SEASON_ID));
    }
    if (sql.includes('FROM "memberships"')) {
      return Promise.resolve(rowsFor(options.membershipExists, MEMBERSHIP_ID));
    }
    if (sql.includes('INSERT INTO "memberships"')) {
      return Promise.resolve(insertRows(options, 'memberships', MEMBERSHIP_ID));
    }
    if (sql.includes('FROM "roles"')) {
      return Promise.resolve(
        options.roleExists === false ? [] : [{ id: ROLE_ID }],
      );
    }
    if (sql.includes('FROM "user_role_assignments"')) {
      return Promise.resolve(rowsFor(options.assignmentExists, ASSIGNMENT_ID));
    }
    return Promise.resolve([]);
  });
  return { query } as unknown as QueryRunner & { query: typeof query };
}

describe('seedTeam', () => {
  it('creates the team, season, membership, lifecycle event, and assignment', async () => {
    const queryRunner = buildQueryRunner();

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).resolves.toEqual({
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      membershipId: MEMBERSHIP_ID,
    });

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "teams"'),
      ['un', 'Ultimate Natives', '#000000', ADMIN_ID],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "seasons"'),
      [TEAM_ID, 'Season ', SeasonStatus.Active, ADMIN_ID],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "memberships"'),
      [TEAM_ID, ADMIN_ID, MembershipStatus.Active],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "membership_status_events"'),
      [MEMBERSHIP_ID, MembershipStatus.Active, ADMIN_ID],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM "roles"'),
      [RbacRole.TeamAdmin],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "user_role_assignments"'),
      [ADMIN_ID, ROLE_ID, TEAM_ID],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "rbac_policy_version"'),
      [],
    );
  });

  it('derives the season slug, name, and dates from the database clock', async () => {
    const queryRunner = buildQueryRunner();

    await seedTeam(queryRunner, ADMIN_EMAIL);

    const [sql] = queryRunner.query.mock.calls.find(call =>
      call[0].includes('INSERT INTO "seasons"'),
    ) ?? [''];
    expect(sql).toContain(`to_char(now(), 'YYYY')`);
    expect(sql).toContain(`date_trunc('year', now())::date`);
  });

  it('is a no-op write-wise when every row already exists', async () => {
    const queryRunner = buildQueryRunner({
      teamExists: true,
      seasonExists: true,
      membershipExists: true,
      assignmentExists: true,
    });

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).resolves.toEqual({
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      membershipId: MEMBERSHIP_ID,
    });

    for (const statement of [
      'INSERT INTO "teams"',
      'INSERT INTO "seasons"',
      'INSERT INTO "memberships"',
      'INSERT INTO "membership_status_events"',
      'INSERT INTO "user_role_assignments"',
    ]) {
      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining(statement),
        expect.anything(),
      );
    }
  });

  it('matches the administrator case-insensitively and ignores deleted rows', async () => {
    const queryRunner = buildQueryRunner();

    await seedTeam(queryRunner, ADMIN_EMAIL);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('lower("email") = lower($1)'),
      [ADMIN_EMAIL],
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('"deleted_at" IS NULL'),
      [ADMIN_EMAIL],
    );
  });

  it('throws when the administrator account has not been seeded', async () => {
    const queryRunner = buildQueryRunner({ adminMissing: true });

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).rejects.toThrow(
      'The seeded administrator account is missing.',
    );
  });

  it('throws when the RBAC migration has not seeded the TEAM_ADMIN role', async () => {
    const queryRunner = buildQueryRunner({ roleExists: false });

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).rejects.toThrow(
      'Role "TEAM_ADMIN" is missing. Run "npm run migration:run" before seeding.',
    );
  });

  it('throws when the team insert returns no id', async () => {
    const queryRunner = buildQueryRunner({ emptyInsert: 'teams' });

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).rejects.toThrow(
      'Team insert did not return an id',
    );
  });

  it('throws when the season insert returns no id', async () => {
    const queryRunner = buildQueryRunner({ emptyInsert: 'seasons' });

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).rejects.toThrow(
      'Season insert did not return an id',
    );
  });

  it('throws when the membership insert returns no id', async () => {
    const queryRunner = buildQueryRunner({ emptyInsert: 'memberships' });

    await expect(seedTeam(queryRunner, ADMIN_EMAIL)).rejects.toThrow(
      'Membership insert did not return an id',
    );
  });
});

describe('createSeedTeamSeeder', () => {
  it('exposes the team key and a definition-derived checksum', () => {
    const seeder = createSeedTeamSeeder(() => ADMIN_EMAIL);

    expect(seeder.key).toBe(SEED_TEAM_KEY);
    expect(seeder.checksum).toBe(computeSeedChecksum(TEAM_SEED_DEFINITION));
  });

  it('keeps the checksum stable across administrator emails', () => {
    const first = createSeedTeamSeeder(() => ADMIN_EMAIL);
    const second = createSeedTeamSeeder(() => 'someone-else@example.test');

    expect(second.checksum).toBe(first.checksum);
  });

  it('resolves the administrator email lazily, only when run', () => {
    const loadAdminEmail = vi.fn(() => ADMIN_EMAIL);

    createSeedTeamSeeder(loadAdminEmail);

    expect(loadAdminEmail).not.toHaveBeenCalled();
  });

  it('provisions the team through the scope query runner', async () => {
    const loadAdminEmail = vi.fn(() => ADMIN_EMAIL);
    const queryRunner = buildQueryRunner();
    const seeder = createSeedTeamSeeder(loadAdminEmail);

    await seeder.run({ queryRunner });

    expect(loadAdminEmail).toHaveBeenCalledOnce();
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "teams"'),
      ['un', 'Ultimate Natives', '#000000', ADMIN_ID],
    );
  });
});
