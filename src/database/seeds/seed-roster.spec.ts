import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import {
  ROSTER_PLAYERS,
  STAFF_ASSIGNMENTS,
  STAFF_ONLY_MEMBERS,
  STAFF_TITLES,
} from './seed-roster.constants';
import { createSeedRosterSeeder, seedRoster, seedStaffAssignments } from './seed-roster';
import { computeSeedChecksum } from './seed-checksum';
import { ROSTER_SEED_DEFINITION, SEED_ROSTER_KEY } from './seed.constants';

const TEAM_ID = 'team-1';

interface HarnessOptions {
  /** full_name+nickname keys already present in member_profiles. */
  readonly existingPlayers?: ReadonlySet<string>;
  readonly teamMissing?: boolean;
}

function buildQueryRunner(options: HarnessOptions = {}) {
  let membershipCounter = 0;
  const query = vi.fn((sql: string, params: readonly unknown[] = []) => {
    if (sql.includes('FROM "teams"')) {
      return Promise.resolve(options.teamMissing === true ? [] : [{ id: TEAM_ID }]);
    }
    if (sql.includes('SELECT "id" FROM "reference_catalog_entries"')) {
      const key = params[2] as string;
      return Promise.resolve([{ id: `title-${key}` }]);
    }
    if (sql.includes('INSERT INTO "reference_catalog_entries"')) {
      return Promise.resolve([]);
    }
    if (sql.includes('FROM "member_profiles"') && sql.includes('membership_id')) {
      const [, fullName, nickname] = params as [string, string, string];
      const identity = `${fullName}::${nickname}`;
      return Promise.resolve(
        options.existingPlayers?.has(identity) === true
          ? [{ id: `existing-${identity}` }]
          : [],
      );
    }
    if (sql.includes('INSERT INTO "memberships"')) {
      membershipCounter += 1;
      return Promise.resolve([{ id: `mem-${String(membershipCounter)}` }]);
    }
    if (sql.includes('INSERT INTO "membership_status_events"')) {
      return Promise.resolve([]);
    }
    if (sql.includes('INSERT INTO "member_profiles"')) {
      return Promise.resolve([]);
    }
    if (sql.includes('INSERT INTO "team_staff_assignments"')) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  });
  return { query } as unknown as QueryRunner & { query: typeof query };
}

const TOTAL_PLAYERS = ROSTER_PLAYERS.length + STAFF_ONLY_MEMBERS.length;
const TOTAL_ASSIGNMENTS = STAFF_ASSIGNMENTS.reduce(
  (sum, assignment) => sum + assignment.titleKeys.length,
  0,
);

describe('seedRoster', () => {
  it('throws when the Ultimate Natives team is missing', async () => {
    const queryRunner = buildQueryRunner({ teamMissing: true });

    await expect(seedRoster(queryRunner)).rejects.toThrow(/Team "un" is missing/);
  });

  it('seeds the staff-title catalog before anyone can be assigned a title', async () => {
    const queryRunner = buildQueryRunner();

    await seedRoster(queryRunner);

    for (const title of STAFF_TITLES) {
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "reference_catalog_entries"'),
        [TEAM_ID, 'staff_title', title.key, title.label, title.position],
      );
    }
  });

  it('seeds one membership for every rostered player and every staff-only member', async () => {
    const queryRunner = buildQueryRunner();

    await seedRoster(queryRunner);

    const membershipInserts = queryRunner.query.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO "memberships"'),
    );
    expect(membershipInserts).toHaveLength(TOTAL_PLAYERS);
  });

  it('carries the printed shirt number, including a leading zero, onto the profile', async () => {
    const queryRunner = buildQueryRunner();
    const mahmoud = ROSTER_PLAYERS.find((player) => player.key === 'mahmoud-nasr');
    expect(mahmoud?.jersey).toBe('011');

    await seedRoster(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "member_profiles"'),
      expect.arrayContaining(['Mahmoud Nasr', 'Hoodz', '011']),
    );
  });

  it('does not re-insert a player whose membership already exists', async () => {
    const queryRunner = buildQueryRunner({
      existingPlayers: new Set(['Sherif Ashraf::3alamy']),
    });

    await seedRoster(queryRunner);

    const membershipInserts = queryRunner.query.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO "memberships"'),
    );
    expect(membershipInserts).toHaveLength(TOTAL_PLAYERS - 1);
  });

  it('keeps the two people named Sherif Ashraf distinct by nickname', async () => {
    const queryRunner = buildQueryRunner();

    await seedRoster(queryRunner);

    const profileInserts = queryRunner.query.mock.calls
      .filter(([sql]) => (sql as string).includes('INSERT INTO "member_profiles"'))
      .map(([, params]) => params as readonly unknown[]);
    const sherifs = profileInserts.filter((params) => params[2] === 'Sherif Ashraf');

    expect(sherifs).toHaveLength(2);
    expect(sherifs.map((params) => params[3]).sort()).toEqual(['3alamy', 'Nemo']);
  });

  it('assigns every Season Board title, including all three of Ihab Khaled\'s', async () => {
    const queryRunner = buildQueryRunner();

    await seedRoster(queryRunner);

    const assignmentInserts = queryRunner.query.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO "team_staff_assignments"'),
    );
    expect(assignmentInserts).toHaveLength(TOTAL_ASSIGNMENTS);

    const ihab = STAFF_ASSIGNMENTS.find((assignment) => assignment.playerKey === 'ihab-khaled');
    expect(ihab?.titleKeys).toEqual(['analysis', 'technical']);
  });
});

describe('seedRoster failure guards', () => {
  it('throws when a catalog entry insert did not produce an id', async () => {
    const queryRunner = buildQueryRunner();
    vi.mocked(queryRunner.query).mockImplementation((sql: string) => {
      if ((sql as string).includes('SELECT "id" FROM "reference_catalog_entries"')) {
        return Promise.resolve([]);
      }
      if ((sql as string).includes('FROM "teams"')) {
        return Promise.resolve([{ id: TEAM_ID }]);
      }
      return Promise.resolve([]);
    });

    await expect(seedRoster(queryRunner)).rejects.toThrow(
      /Staff title catalog entry insert did not return an id/,
    );
  });

  it('throws when a membership insert did not produce an id', async () => {
    const queryRunner = buildQueryRunner();
    vi.mocked(queryRunner.query).mockImplementation((sql: string) => {
      if ((sql as string).includes('FROM "teams"')) {
        return Promise.resolve([{ id: TEAM_ID }]);
      }
      if ((sql as string).includes('SELECT "id" FROM "reference_catalog_entries"')) {
        return Promise.resolve([{ id: 'title-x' }]);
      }
      if ((sql as string).includes('INSERT INTO "memberships"')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    await expect(seedRoster(queryRunner)).rejects.toThrow(
      /Roster membership insert did not return an id/,
    );
  });

});

describe('seedStaffAssignments guards', () => {
  // Both guards below are defensive against future data drift — every real
  // STAFF_ASSIGNMENTS playerKey and titleKey is drawn from ROSTER_PLAYERS/
  // STAFF_ONLY_MEMBERS and STAFF_TITLES, so neither map is ever actually
  // missing an entry through seedRoster itself. Exercised directly here.
  it('skips an assignment whose player has no resolved membership', async () => {
    const queryRunner = buildQueryRunner();

    await seedStaffAssignments(
      queryRunner,
      TEAM_ID,
      new Map([['coach', 'title-coach']]),
      new Map(), // no memberships resolved
    );

    const assignmentInserts = queryRunner.query.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO "team_staff_assignments"'),
    );
    expect(assignmentInserts).toHaveLength(0);
  });

  it('skips a title the catalog step never produced an id for', async () => {
    const queryRunner = buildQueryRunner();

    await seedStaffAssignments(
      queryRunner,
      TEAM_ID,
      new Map(), // no titles resolved
      new Map([['3alamy', 'mem-1']]),
    );

    const assignmentInserts = queryRunner.query.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO "team_staff_assignments"'),
    );
    expect(assignmentInserts).toHaveLength(0);
  });
});

describe('createSeedRosterSeeder', () => {
  it('carries the roster seed key and a definition-derived checksum', () => {
    const seeder = createSeedRosterSeeder();

    expect(seeder.key).toBe(SEED_ROSTER_KEY);
    expect(seeder.checksum).toBe(computeSeedChecksum(ROSTER_SEED_DEFINITION));
  });

  it('runs against the scope\'s query runner', async () => {
    const queryRunner = buildQueryRunner();
    const seeder = createSeedRosterSeeder();

    await expect(seeder.run({ queryRunner })).resolves.toBeUndefined();
    expect(queryRunner.query).toHaveBeenCalled();
  });
});
