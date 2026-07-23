import { MembershipStatus } from '@modules/members';
import { CatalogName } from '@modules/teams';
import { RbacRole, Role } from '@shared/enums';

import type {
  PersonaDefinition,
  PracticeSessionDefinition,
  VenueDefinition,
} from './seed-personas.types';
import { PersonaScope } from './seed-personas.types';

/**
 * The demonstration persona cast. Every screen in the product has at least one
 * account that can exercise it, so a fresh database is immediately usable:
 *
 *  - a PLATFORM super administrator (global, teamId IS NULL assignment plus the
 *    `admin` account role) who can create and browse teams;
 *  - a second platform super administrator with NO team membership at all, so
 *    the "platform role alone must not fabricate team membership" invariant is
 *    testable end to end (zero membership rows, zero member profiles);
 *  - a team administrator, a head coach, an assistant coach, a scorekeeper and
 *    an analyst, all scoped to team "un" — none of whom can create or browse
 *    teams, which is exactly the split the platform permissions encode;
 *  - six regular players so directories, leaderboards and rosters are populated.
 *
 * Emails use the reserved `.local` suffix and carry no real personal data. The
 * shared password is supplied at runtime (SEED_PERSONA_PASSWORD) and is never
 * part of a definition or checksum.
 */
export const PERSONA_DEFINITIONS: readonly PersonaDefinition[] = [
  {
    email: 'superadmin@ultimatenatives.local',
    displayName: 'Nadia Super Admin',
    accountRole: Role.Admin,
    roleKey: RbacRole.SuperAdmin,
    scope: PersonaScope.Platform,
    teamMembership: true,
  },
  {
    email: 'platformonly@ultimatenatives.local',
    displayName: 'Nour Platform Only',
    accountRole: Role.Admin,
    roleKey: RbacRole.SuperAdmin,
    scope: PersonaScope.Platform,
    teamMembership: false,
  },
  {
    email: 'teamadmin@ultimatenatives.local',
    displayName: 'Tarek Team Admin',
    accountRole: Role.User,
    roleKey: RbacRole.TeamAdmin,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'headcoach@ultimatenatives.local',
    displayName: 'Hana Head Coach',
    accountRole: Role.User,
    roleKey: RbacRole.Coach,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'assistantcoach@ultimatenatives.local',
    displayName: 'Amir Assistant Coach',
    accountRole: Role.User,
    roleKey: RbacRole.Coach,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'scorekeeper@ultimatenatives.local',
    displayName: 'Sara Scorekeeper',
    accountRole: Role.User,
    roleKey: RbacRole.Scorekeeper,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'analyst@ultimatenatives.local',
    displayName: 'Adel Analyst',
    accountRole: Role.User,
    roleKey: RbacRole.Analyst,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'player1@ultimatenatives.local',
    displayName: 'Player One',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'player2@ultimatenatives.local',
    displayName: 'Player Two',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'player3@ultimatenatives.local',
    displayName: 'Player Three',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'player4@ultimatenatives.local',
    displayName: 'Player Four',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'player5@ultimatenatives.local',
    displayName: 'Player Five',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
  {
    email: 'player6@ultimatenatives.local',
    displayName: 'Player Six',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
    teamMembership: true,
  },
];

/**
 * Reference catalog entries so the division / gender-format / position pickers
 * that squads, rosters and profiles depend on are never empty on a fresh
 * database. Entries are archived, never deleted, by the owning module.
 */
export const CATALOG_DEFINITIONS: readonly (readonly [
  CatalogName,
  string,
  string,
  number,
])[] = [
  [CatalogName.Division, 'open', 'Open', 0],
  [CatalogName.Division, 'women', 'Women', 1],
  [CatalogName.Division, 'mixed', 'Mixed', 2],
  [CatalogName.GenderFormat, 'open', 'Open', 0],
  [CatalogName.GenderFormat, 'womens', 'Women only', 1],
  [CatalogName.GenderFormat, 'mixed', 'Mixed', 2],
  [CatalogName.Position, 'handler', 'Handler', 0],
  [CatalogName.Position, 'cutter', 'Cutter', 1],
  [CatalogName.Position, 'deep', 'Deep', 2],
];

/** Practice/competition locations so scheduling screens have a venue to pick. */
export const VENUE_DEFINITIONS: readonly VenueDefinition[] = [
  { name: 'Cairo Main Field', address: 'Nasr City, Cairo' },
  { name: 'Riverside Training Ground', address: 'Zamalek, Cairo' },
];

// --- The demonstration practice program --------------------------------------
// Published, venue-linked sessions positioned RELATIVE to now() at seed time,
// which the once-only framework permits (a seeder runs exactly once per
// database). Static instants could never keep the P3-B1 self check-in window
// (starts_at − 60 min .. ends_at, published sessions only) OPEN at boot; the
// in-progress session below starts 30 minutes before the seed instant and ends
// 90 minutes after it, so its window is open the moment a fresh stack comes up
// and its attendance sheet is startable by the coach right away. Past sessions
// give attendance history surfaces data; upcoming ones feed RSVP (one carries a
// future cutoff). Session-type strings mirror the legacy attendance weights
// (practice / fitness / game / throwing). Values persisted are constrained by
// the practices schema check constraints; the status literal below is
// SessionStatus.Published in the practices module (not exported via its index).
export const PRACTICE_SESSION_DEFINITIONS: readonly PracticeSessionDefinition[] =
  [
    {
      notes: 'Seeded demo practice — last week',
      sessionType: 'practice',
      venueName: 'Cairo Main Field',
      startOffsetMinutes: -10_080,
      durationMinutes: 120,
      rsvpCutoffOffsetMinutes: null,
    },
    {
      notes: 'Seeded demo fitness — three days ago',
      sessionType: 'fitness',
      venueName: 'Riverside Training Ground',
      startOffsetMinutes: -4320,
      durationMinutes: 90,
      rsvpCutoffOffsetMinutes: null,
    },
    {
      notes: 'Seeded demo practice — in progress',
      sessionType: 'practice',
      venueName: 'Cairo Main Field',
      startOffsetMinutes: -30,
      durationMinutes: 120,
      rsvpCutoffOffsetMinutes: null,
    },
    {
      notes: 'Seeded demo practice — in two days',
      sessionType: 'practice',
      venueName: 'Cairo Main Field',
      startOffsetMinutes: 2880,
      durationMinutes: 120,
      rsvpCutoffOffsetMinutes: -120,
    },
    {
      notes: 'Seeded demo throwing — next week',
      sessionType: 'throwing',
      venueName: 'Riverside Training Ground',
      startOffsetMinutes: 10_080,
      durationMinutes: 90,
      rsvpCutoffOffsetMinutes: -180,
    },
  ];

/** Session rows are inserted as published, team-visible occurrences. */
export const PRACTICE_SESSION_STATUS = 'published';
export const PRACTICE_SESSION_VISIBILITY = 'team';

// --- The demonstration match program ------------------------------------------
// One catalogued opponent, one published friendly competition in the seeded
// current season, one active ruleset version, one fixture scheduled for
// tomorrow (relative to the seed instant) and its single authoritative
// scheduled match — the scorekeeper journey's queue on a fresh database. The
// status/type literals mirror the competitions and matches schema check
// constraints (those modules do not export their enums via their index).
export const DEMO_OPPONENT_NAME = 'Cairo Disc Club';
export const DEMO_OPPONENT_SHORT_NAME = 'CDC';
export const DEMO_COMPETITION_NAME = 'Demonstration Friendly Series';
export const DEMO_COMPETITION_TYPE = 'friendly';
export const DEMO_COMPETITION_STATUS = 'published';
export const DEMO_RULESET_KEY = 'demo-standard';
export const DEMO_RULESET_NAME = 'Demonstration standard (game to 15)';
export const DEMO_RULESET_GAME_TO = 15;
export const DEMO_RULESET_WIN_BY = 1;
export const DEMO_RULESET_HALFTIME_AT = 8;
export const DEMO_RULESET_TIMEOUTS_PER_TEAM = 2;
export const DEMO_RULESET_PERIODS = 2;
export const DEMO_FIXTURE_VENUE_NAME = 'Cairo Main Field';
export const DEMO_FIXTURE_HOME_AWAY = 'home';
export const DEMO_FIXTURE_OFFSET_MINUTES = 1440;
export const DEMO_MATCH_COUNT = 1;

// --- Seed actors --------------------------------------------------------------
// The head coach organizes the practice program; the team administrator owns
// the match program. Both resolve to persona user ids seeded earlier in the
// same run.
export const PRACTICE_ORGANIZER_EMAIL = 'headcoach@ultimatenatives.local';
export const DEMO_PROGRAM_ACTOR_EMAIL = 'teamadmin@ultimatenatives.local';

export const PERSONA_MEMBERSHIP_STATUS = MembershipStatus.Active;

// --- Failure messages --------------------------------------------------------
export const PERSONA_TEAM_MISSING_MESSAGE =
  'The seeded team "un" is missing. Run the "team-ultimate-natives" seeder before seeding personas.';
export const PERSONA_SEASON_MISSING_MESSAGE =
  'The seeded current season is missing. Run the "team-ultimate-natives" seeder before seeding personas.';
export const PERSONA_ROLE_MISSING_PREFIX =
  'RBAC role is missing; run "npm run migration:run" before seeding personas: ';
export const PERSONA_VENUE_MISSING_PREFIX =
  'Seeded venue is missing for the demonstration schedule: ';
export const PERSONA_ACTOR_MISSING_PREFIX =
  'Seed actor persona is missing from the cast: ';
export const PERSONA_USER_INSERT_FAILED_MESSAGE =
  'Persona user insert did not return an id';
export const PERSONA_MEMBERSHIP_INSERT_FAILED_MESSAGE =
  'Persona membership insert did not return an id';
export const PERSONA_SESSION_INSERT_FAILED_MESSAGE =
  'Practice session insert did not return an id';
export const PERSONA_DEMO_INSERT_FAILED_PREFIX =
  'Demonstration seed insert did not return an id: ';
