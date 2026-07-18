const LOWER_THEN_UPPER = /([a-z0-9])([A-Z])/gu;
const UPPER_RUN_THEN_WORD = /([A-Z]+)([A-Z][a-z])/gu;

/**
 * Convert an identifier to snake_case (e.g. `createdAt` -> `created_at`,
 * `teamSeasonId` -> `team_season_id`). Used by the naming strategy so every
 * table and column follows the Postgres snake_case convention.
 */
export function toSnakeCase(value: string): string {
  return value
    .replace(UPPER_RUN_THEN_WORD, '$1_$2')
    .replace(LOWER_THEN_UPPER, '$1_$2')
    .toLowerCase();
}
