import { MembershipStatus } from '@modules/members';
import { SeasonStatus } from '@modules/teams';
import { RbacRole } from '@shared/enums';

// --- The owner-requested real team ------------------------------------------
// The teams module's canonical slug form is lowercase kebab-case
// (`SLUG_PATTERN` in @modules/teams model constants) and the `ux_teams_slug`
// unique index is on lower("slug"), so "UN" is stored as its canonical `un`.
// Locale, timezone, and status are intentionally omitted from the insert so the
// schema defaults ('en', 'Africa/Cairo', 'active') apply verbatim.
export const TEAM_SLUG = 'un';
export const TEAM_NAME = 'Ultimate Natives';
// Black, as the canonical 6-digit hex the teams module's branding field carries.
export const TEAM_PRIMARY_COLOR = '#000000';

// --- The default season ------------------------------------------------------
// Squads and competitions require a season id, so a fresh database needs one for
// those screens to function. The season covers the calendar year the database is
// first seeded in; slug and dates are derived from the database clock in SQL, so
// the seeder definition (and therefore its checksum) never encodes a year.
export const SEASON_NAME_PREFIX = 'Season ';
export const SEASON_STATUS = SeasonStatus.Active;

// --- The administrator's link into the team ---------------------------------
// A season-independent (season_id IS NULL) active membership: the administrator
// belongs to the team itself, and the members read model resolves whichever
// season currently covers "now" for display.
export const MEMBERSHIP_STATUS = MembershipStatus.Active;
export const TEAM_ADMIN_ROLE_KEY = RbacRole.TeamAdmin;

// --- Failure messages --------------------------------------------------------
export const ADMIN_USER_MISSING_MESSAGE =
  'The seeded administrator account is missing. Run the "admin" seeder before seeding the team.';
export const TEAM_ADMIN_ROLE_MISSING_MESSAGE =
  'Role "TEAM_ADMIN" is missing. Run "npm run migration:run" before seeding.';
export const TEAM_INSERT_FAILED_MESSAGE = 'Team insert did not return an id';
export const SEASON_INSERT_FAILED_MESSAGE =
  'Season insert did not return an id';
export const MEMBERSHIP_INSERT_FAILED_MESSAGE =
  'Membership insert did not return an id';
