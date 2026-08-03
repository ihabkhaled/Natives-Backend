import type { SeedCompetition } from './seed-competitions.types';

// Stable identity of the real-competitions seeder.
export const SEED_COMPETITIONS_KEY = 'competitions-ultimate-natives';

// Definition digest. The framework skips a seeder whose checksum matches the
// row already in seed_history, so this string must change only when the
// seeder's BEHAVIOUR does. Bump the trailing version in that case.
export const COMPETITIONS_SEED_DEFINITION =
  'competitions-seeder:v1:' +
  'insert-published-competitions-for-the-current-season';

export const COMPETITIONS_TEAM_MISSING_MESSAGE =
  'Competition seed failed: the team has not been seeded.';
export const COMPETITIONS_SEASON_MISSING_MESSAGE =
  'Competition seed failed: the current season has not been seeded.';

/**
 * The competitions Ultimate Natives has entered, as the public site announces
 * them. Published rather than draft: these are committed entries, and only a
 * published competition is publicly visible.
 *
 * Placements are deliberately absent — no result was supplied, and the page
 * says "results pending" rather than inventing a finish.
 */
export const SEED_COMPETITIONS: readonly SeedCompetition[] = [
  { name: 'EUNC 2026', competitionType: 'tournament' },
  { name: 'EUDL 2026', competitionType: 'league' },
];

export const COMPETITION_SEED_STATUS = 'published';
