import { MembershipStatus } from '@modules/members';
import { CatalogName } from '@modules/teams';
import { RbacRole, Role } from '@shared/enums';

import type { PersonaDefinition, VenueDefinition } from './seed-personas.types';
import { PersonaScope } from './seed-personas.types';

/**
 * The demonstration persona cast. Every screen in the product has at least one
 * account that can exercise it, so a fresh database is immediately usable:
 *
 *  - a PLATFORM super administrator (global, teamId IS NULL assignment plus the
 *    `admin` account role) who can create and browse teams;
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
  },
  {
    email: 'teamadmin@ultimatenatives.local',
    displayName: 'Tarek Team Admin',
    accountRole: Role.User,
    roleKey: RbacRole.TeamAdmin,
    scope: PersonaScope.Team,
  },
  {
    email: 'headcoach@ultimatenatives.local',
    displayName: 'Hana Head Coach',
    accountRole: Role.User,
    roleKey: RbacRole.Coach,
    scope: PersonaScope.Team,
  },
  {
    email: 'assistantcoach@ultimatenatives.local',
    displayName: 'Amir Assistant Coach',
    accountRole: Role.User,
    roleKey: RbacRole.Coach,
    scope: PersonaScope.Team,
  },
  {
    email: 'scorekeeper@ultimatenatives.local',
    displayName: 'Sara Scorekeeper',
    accountRole: Role.User,
    roleKey: RbacRole.Scorekeeper,
    scope: PersonaScope.Team,
  },
  {
    email: 'analyst@ultimatenatives.local',
    displayName: 'Adel Analyst',
    accountRole: Role.User,
    roleKey: RbacRole.Analyst,
    scope: PersonaScope.Team,
  },
  {
    email: 'player1@ultimatenatives.local',
    displayName: 'Player One',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
  },
  {
    email: 'player2@ultimatenatives.local',
    displayName: 'Player Two',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
  },
  {
    email: 'player3@ultimatenatives.local',
    displayName: 'Player Three',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
  },
  {
    email: 'player4@ultimatenatives.local',
    displayName: 'Player Four',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
  },
  {
    email: 'player5@ultimatenatives.local',
    displayName: 'Player Five',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
  },
  {
    email: 'player6@ultimatenatives.local',
    displayName: 'Player Six',
    accountRole: Role.User,
    roleKey: RbacRole.Member,
    scope: PersonaScope.Team,
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

export const PERSONA_MEMBERSHIP_STATUS = MembershipStatus.Active;

// --- Failure messages --------------------------------------------------------
export const PERSONA_TEAM_MISSING_MESSAGE =
  'The seeded team "un" is missing. Run the "team-ultimate-natives" seeder before seeding personas.';
export const PERSONA_ROLE_MISSING_PREFIX =
  'RBAC role is missing; run "npm run migration:run" before seeding personas: ';
export const PERSONA_USER_INSERT_FAILED_MESSAGE =
  'Persona user insert did not return an id';
export const PERSONA_MEMBERSHIP_INSERT_FAILED_MESSAGE =
  'Persona membership insert did not return an id';
