import type { RbacRole, Role } from '@shared/enums';

/** Whether a persona's role assignment is platform-wide or bound to team "un". */
export enum PersonaScope {
  Platform = 'platform',
  Team = 'team',
}

export const PERSONA_SCOPE_VALUES: readonly PersonaScope[] =
  Object.values(PersonaScope);

/**
 * One demonstration account: who they are and what authority they hold.
 * `teamMembership` states whether the persona belongs to team "un" — the
 * platform-only super admin deliberately holds NO membership (and therefore no
 * member profile), so the "platform role alone must not fabricate team
 * membership" invariant is journey-testable on a fresh database.
 */
export interface PersonaDefinition {
  readonly email: string;
  readonly displayName: string;
  readonly accountRole: Role;
  readonly roleKey: RbacRole;
  readonly scope: PersonaScope;
  readonly teamMembership: boolean;
}

/** A seeded practice/competition location. */
export interface VenueDefinition {
  readonly name: string;
  readonly address: string;
}

/**
 * One seeded practice session, positioned RELATIVE to the database clock at
 * seed time (the once-only framework runs a seeder exactly once per database,
 * so "now" is the boot that first seeds it). Offsets are minutes from now():
 * a negative start offset is a past/in-progress session, a positive one is
 * upcoming. The RSVP cutoff offset is minutes relative to the session start
 * (negative = before start), or null for no cutoff. `notes` doubles as the
 * find-then-write natural key within the team — ad-hoc sessions have no
 * schedule/occurrence key.
 */
export interface PracticeSessionDefinition {
  readonly notes: string;
  readonly sessionType: string;
  readonly venueName: string;
  readonly startOffsetMinutes: number;
  readonly durationMinutes: number;
  readonly rsvpCutoffOffsetMinutes: number | null;
}

/** Team/season/actor scope shared by the demonstration schedule seeding steps. */
export interface DemoSeedScope {
  readonly teamId: string;
  readonly seasonId: string;
  readonly actorUserId: string;
}

export interface IdRow {
  readonly id: string;
}

/** Counters describing what one persona seed run created or reused. */
export interface SeedPersonasResult {
  readonly personas: number;
  readonly catalogEntries: number;
  readonly venues: number;
  readonly practiceSessions: number;
  readonly matches: number;
}
