import type { QueryRunner } from 'typeorm';

import { ROSTER_SEED_DEFINITION, SEED_ROSTER_KEY } from './seed.constants';
import type { Seeder, SeedScope } from './seed.types';
import { computeSeedChecksum } from './seed-checksum';
import {
  CATALOG_INSERT_FAILED_MESSAGE,
  MEMBERSHIP_INSERT_FAILED_MESSAGE,
  ROSTER_MEMBERSHIP_STATUS,
  ROSTER_PLAYERS,
  STAFF_ASSIGNMENTS,
  STAFF_ONLY_MEMBERS,
  STAFF_TITLE_CATALOG,
  STAFF_TITLES,
  TEAM_MISSING_MESSAGE,
} from './seed-roster.constants';
import type { RosterPlayer } from './seed-roster.types';
import { TEAM_SLUG } from './seed-team.constants';

interface IdRow {
  readonly id: string;
}

/**
 * Seeds the real Ultimate Natives roster and the Season Board's staff
 * responsibilities.
 *
 * Rostered players are memberships WITHOUT user accounts: the team's shirt list
 * is roster data, not a set of logins. A player who later needs to sign in is
 * invited through the normal flow, which attaches their account to the
 * membership seeded here. Registered after the team seeder, whose team every
 * membership hangs off.
 */
export function createSeedRosterSeeder(): Seeder {
  return {
    key: SEED_ROSTER_KEY,
    checksum: computeSeedChecksum(ROSTER_SEED_DEFINITION),
    run: (scope: SeedScope): Promise<void> => seedRoster(scope.queryRunner),
  };
}

export async function seedRoster(queryRunner: QueryRunner): Promise<void> {
  const teamId = await resolveTeamId(queryRunner);
  const titleIds = await seedStaffTitles(queryRunner, teamId);

  const membershipIds = new Map<string, string>();
  for (const player of [...ROSTER_PLAYERS, ...STAFF_ONLY_MEMBERS]) {
    membershipIds.set(
      player.key,
      await seedPlayer(queryRunner, teamId, player),
    );
  }

  await seedStaffAssignments(queryRunner, teamId, titleIds, membershipIds);
}

async function resolveTeamId(queryRunner: QueryRunner): Promise<string> {
  const rows = (await queryRunner.query(
    `SELECT "id" FROM "teams" WHERE lower("slug") = $1`,
    [TEAM_SLUG],
  )) as readonly IdRow[];
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(TEAM_MISSING_MESSAGE);
  }
  return id;
}

async function seedStaffTitles(
  queryRunner: QueryRunner,
  teamId: string,
): Promise<ReadonlyMap<string, string>> {
  const ids = new Map<string, string>();
  for (const title of STAFF_TITLES) {
    await queryRunner.query(
      `INSERT INTO "reference_catalog_entries"
         ("team_id", "catalog", "key", "label", "sort_order")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("team_id", "catalog", "key") DO NOTHING`,
      [teamId, STAFF_TITLE_CATALOG, title.key, title.label, title.position],
    );
    const rows = (await queryRunner.query(
      `SELECT "id" FROM "reference_catalog_entries"
        WHERE "team_id" = $1 AND "catalog" = $2 AND "key" = $3`,
      [teamId, STAFF_TITLE_CATALOG, title.key],
    )) as readonly IdRow[];
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new Error(CATALOG_INSERT_FAILED_MESSAGE);
    }
    ids.set(title.key, id);
  }
  return ids;
}

/**
 * One membership plus its profile. `user_id` is deliberately NULL — see the
 * seeder docblock. The profile carries the display data the public directory
 * reads: full name, nickname and shirt number.
 */
async function seedPlayer(
  queryRunner: QueryRunner,
  teamId: string,
  player: RosterPlayer,
): Promise<string> {
  const existing = (await queryRunner.query(
    `SELECT "membership_id" AS "id" FROM "member_profiles"
      WHERE "team_id" = $1 AND "full_name" = $2 AND "nickname" = $3`,
    [teamId, player.fullName, player.nickname],
  )) as readonly IdRow[];
  const already = existing[0]?.id;
  if (already !== undefined) {
    return already;
  }

  const rows = (await queryRunner.query(
    `INSERT INTO "memberships" ("team_id", "user_id", "status",
            "status_effective_at", "joined_at")
     VALUES ($1, NULL, $2, now(), now())
     RETURNING "id"`,
    [teamId, ROSTER_MEMBERSHIP_STATUS],
  )) as readonly IdRow[];
  const membershipId = rows[0]?.id;
  if (membershipId === undefined) {
    throw new Error(MEMBERSHIP_INSERT_FAILED_MESSAGE);
  }

  await queryRunner.query(
    `INSERT INTO "membership_status_events" ("membership_id", "from_status",
            "to_status", "actor_user_id", "effective_at")
     VALUES ($1, NULL, $2, NULL, now())`,
    [membershipId, ROSTER_MEMBERSHIP_STATUS],
  );

  await queryRunner.query(
    `INSERT INTO "member_profiles" ("membership_id", "team_id", "full_name",
            "nickname", "jersey_number")
     VALUES ($1, $2, $3, $4, $5)`,
    [membershipId, teamId, player.fullName, player.nickname, player.jersey],
  );

  return membershipId;
}

export async function seedStaffAssignments(
  queryRunner: QueryRunner,
  teamId: string,
  titleIds: ReadonlyMap<string, string>,
  membershipIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const assignment of STAFF_ASSIGNMENTS) {
    const membershipId = membershipIds.get(assignment.playerKey);
    if (membershipId === undefined) {
      continue;
    }
    for (const titleKey of assignment.titleKeys) {
      const titleEntryId = titleIds.get(titleKey);
      if (titleEntryId === undefined) {
        continue;
      }
      await queryRunner.query(
        `INSERT INTO "team_staff_assignments"
           ("team_id", "membership_id", "title_entry_id", "photo_url")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [teamId, membershipId, titleEntryId, assignment.photoUrl],
      );
    }
  }
}
