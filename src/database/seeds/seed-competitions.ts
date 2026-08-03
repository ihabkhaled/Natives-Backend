import type { QueryRunner } from 'typeorm';

import type { Seeder, SeedScope } from './seed.types';
import { computeSeedChecksum } from './seed-checksum';
import {
  COMPETITION_SEED_STATUS,
  COMPETITIONS_SEASON_MISSING_MESSAGE,
  COMPETITIONS_SEED_DEFINITION,
  COMPETITIONS_TEAM_MISSING_MESSAGE,
  SEED_COMPETITIONS,
  SEED_COMPETITIONS_KEY,
} from './seed-competitions.constants';
import { TEAM_SLUG } from './seed-team.constants';

interface IdRow {
  readonly id: string;
}

/**
 * Seeds the competitions the team has actually entered, so the public site
 * announces real entries rather than a hardcoded list in the web bundle.
 *
 * Registered after the team seeder, whose team and current season every
 * competition hangs off. Each row is matched by name within the season, so a
 * competition an admin has since renamed or removed is never resurrected.
 */
export function createSeedCompetitionsSeeder(): Seeder {
  return {
    key: SEED_COMPETITIONS_KEY,
    checksum: computeSeedChecksum(COMPETITIONS_SEED_DEFINITION),
    run: (scope: SeedScope): Promise<void> =>
      seedCompetitions(scope.queryRunner),
  };
}

export async function seedCompetitions(
  queryRunner: QueryRunner,
): Promise<void> {
  const teamId = await resolveTeamId(queryRunner);
  const seasonId = await resolveSeasonId(queryRunner, teamId);

  for (const competition of SEED_COMPETITIONS) {
    await insertIfAbsent(queryRunner, teamId, seasonId, competition);
  }
}

async function insertIfAbsent(
  queryRunner: QueryRunner,
  teamId: string,
  seasonId: string,
  competition: { readonly name: string; readonly competitionType: string },
): Promise<void> {
  const existing = (await queryRunner.query(
    `SELECT "id" FROM "competitions"
      WHERE "team_id" = $1 AND "season_id" = $2 AND lower("name") = lower($3)
        AND "deleted_at" IS NULL`,
    [teamId, seasonId, competition.name],
  )) as readonly IdRow[];
  if (existing.length > 0) {
    return;
  }
  await queryRunner.query(
    `INSERT INTO "competitions" ("team_id", "season_id", "name",
            "competition_type", "status", "published_at")
     VALUES ($1, $2, $3, $4, $5, now())`,
    [
      teamId,
      seasonId,
      competition.name,
      competition.competitionType,
      COMPETITION_SEED_STATUS,
    ],
  );
}

async function resolveTeamId(queryRunner: QueryRunner): Promise<string> {
  const rows = (await queryRunner.query(
    `SELECT "id" FROM "teams" WHERE lower("slug") = $1`,
    [TEAM_SLUG],
  )) as readonly IdRow[];
  const row = rows[0];
  if (row === undefined) {
    throw new Error(COMPETITIONS_TEAM_MISSING_MESSAGE);
  }
  return row.id;
}

async function resolveSeasonId(
  queryRunner: QueryRunner,
  teamId: string,
): Promise<string> {
  const rows = (await queryRunner.query(
    `SELECT "id" FROM "seasons"
      WHERE "team_id" = $1 AND lower("slug") = to_char(now(), 'YYYY')`,
    [teamId],
  )) as readonly IdRow[];
  const row = rows[0];
  if (row === undefined) {
    throw new Error(COMPETITIONS_SEASON_MISSING_MESSAGE);
  }
  return row.id;
}
