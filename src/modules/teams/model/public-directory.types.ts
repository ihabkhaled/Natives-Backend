import type { PublicTeamProfile, StaffDirectoryEntry } from './teams.types';

/** One active player's publishable roster fields — no PII, no status/team id. */
export interface PublicRosterPlayer {
  readonly membershipId: string;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly jerseyNumber: string | null;
  readonly positions: readonly string[];
  /** Direct photo URL, null until an admin attaches one (P0: none yet). */
  readonly photoUrl: string | null;
}

/** The full public "who's who" + roster view returned by the directory read. */
export interface PublicTeamDirectoryView {
  readonly profile: PublicTeamProfile;
  readonly staff: readonly StaffDirectoryEntry[];
  readonly players: readonly PublicRosterPlayer[];
}

/** The team-owned half of the directory read, before the roster is joined in. */
export interface TeamAndStaffDirectory {
  readonly profile: PublicTeamProfile;
  readonly staff: readonly StaffDirectoryEntry[];
}
