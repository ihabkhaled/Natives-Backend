import type { RbacRole, Role } from '@shared/enums';

/** Whether a persona's role assignment is platform-wide or bound to team "un". */
export enum PersonaScope {
  Platform = 'platform',
  Team = 'team',
}

export const PERSONA_SCOPE_VALUES: readonly PersonaScope[] =
  Object.values(PersonaScope);

/** One demonstration account: who they are and what authority they hold. */
export interface PersonaDefinition {
  readonly email: string;
  readonly displayName: string;
  readonly accountRole: Role;
  readonly roleKey: RbacRole;
  readonly scope: PersonaScope;
}

/** A seeded practice/competition location. */
export interface VenueDefinition {
  readonly name: string;
  readonly address: string;
}

export interface IdRow {
  readonly id: string;
}

/** Counters describing what one persona seed run created or reused. */
export interface SeedPersonasResult {
  readonly personas: number;
  readonly catalogEntries: number;
  readonly venues: number;
}
