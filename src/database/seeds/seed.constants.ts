import type { SeedApplication } from './seed.types';

// The append-only once-only ledger created by 1722600000000-seed-history-schema.
export const SEED_HISTORY_TABLE = 'seed_history';

// Decision outcomes for one seeder evaluated against seed_history.
export const SEED_APPLIED: SeedApplication = 'applied';
export const SEED_SKIPPED: SeedApplication = 'skipped';
export const SEED_CHANGED: SeedApplication = 'changed';

// Stable identity of the default-administrator seeder recorded in seed_history.
export const SEED_ADMIN_KEY = 'admin';

// Stable identity of the real-team seeder (Ultimate Natives) in seed_history.
export const SEED_TEAM_KEY = 'team-ultimate-natives';

// Stable identity of the demonstration-persona seeder in seed_history.
export const SEED_PERSONAS_KEY = 'personas';

// `applied_by` provenance values distinguishing the boot lifecycle from the CLI.
export const SEED_APPLIED_BY_BOOT = 'boot';
export const SEED_APPLIED_BY_CLI = 'cli';

export const SEED_LOG_CONTEXT = 'DatabaseSeeds';
export const SEED_APPLIED_LOG = 'Seed applied';
export const SEED_SKIPPED_LOG = 'Seed already applied; skipping';
export const SEED_CHECKSUM_CHANGED_LOG =
  'Seed definition changed after it was applied; not re-running (audit and add a new seeder or migration)';

// Content-derived fingerprint source for the admin seeder. It describes the
// seeder's DEFINITION (its ordered effects), never runtime inputs such as the
// email or password, so rotating the admin credential does not change the
// checksum. Bump the trailing version when the seeder's behaviour changes.
export const ADMIN_SEED_DEFINITION =
  'admin-seeder:v1:' +
  'insert-or-update-admin-user;' +
  'upsert-password-credential;' +
  'ensure-global-team-admin-role-assignment';

// Content-derived fingerprint source for the Ultimate Natives team seeder. Like
// the admin definition it names the seeder's ordered effects, never runtime
// inputs (the administrator email it links, or the year the season is derived
// from), so the same definition stays stable across databases and calendar
// years. Bump the trailing version when the seeder's behaviour changes.
export const TEAM_SEED_DEFINITION =
  'team-seeder:v1:' +
  'insert-ultimate-natives-team;' +
  'insert-current-year-season;' +
  'insert-active-admin-membership;' +
  'append-membership-status-event;' +
  'ensure-team-scoped-team-admin-role-assignment;' +
  'bump-rbac-policy-version';

// Content-derived fingerprint source for the demonstration-persona seeder. It
// names the seeder's ordered effects only — never the runtime password it
// provisions the cast with, nor the number of personas' identities — so rotating
// the credential never looks like a definition change. Bump the trailing version
// when the seeder's behaviour changes.
export const PERSONAS_SEED_DEFINITION =
  'personas-seeder:v1:' +
  'insert-persona-users;' +
  'upsert-persona-password-credentials;' +
  'insert-active-team-memberships;' +
  'append-membership-status-events;' +
  'ensure-scoped-role-assignments;' +
  'insert-reference-catalog-entries;' +
  'insert-venues;' +
  'bump-rbac-policy-version';

export const SEED_HISTORY_LOOKUP_SQL = `SELECT "checksum" FROM "${SEED_HISTORY_TABLE}" WHERE "seed_key" = $1`;
export const SEED_HISTORY_INSERT_SQL = `INSERT INTO "${SEED_HISTORY_TABLE}" ("seed_key", "checksum", "applied_by") VALUES ($1, $2, $3)`;
