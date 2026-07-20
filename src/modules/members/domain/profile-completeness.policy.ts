import { PROFILE_COMPLETENESS_FIELD_COUNT } from '../model/members.constants';
import type { ProfileCompletenessRow } from '../model/members.rows';

/**
 * Score how complete a player profile is, as a whole percentage of the optional
 * fields a member is expected to fill in themselves. Full name is excluded
 * because it is mandatory at creation and would inflate every score. Pure: no
 * clock, no I/O, deterministic for a given row.
 */
export function scoreProfileCompleteness(
  profile: ProfileCompletenessRow,
): number {
  const filled = [
    profile.preferred_name !== null,
    profile.email !== null,
    profile.phone !== null,
    profile.gender !== null,
    profile.date_of_birth !== null,
    profile.jersey_number !== null,
    profile.positions.length > 0,
    profile.avatar_media_id !== null,
  ].filter(Boolean).length;
  return Math.round((filled / PROFILE_COMPLETENESS_FIELD_COUNT) * 100);
}
