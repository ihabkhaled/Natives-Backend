import { scoreProfileCompleteness } from '../domain/profile-completeness.policy';
import type {
  MemberSignalCountRow,
  ProfileCompletenessRow,
} from '../model/members.rows';
import type {
  MemberCountSignal,
  MemberProfileSignal,
} from '../model/members.types';
import { toDate, toNullableDate } from './members.helpers';

/** A member with no profile row has nothing scored — null, never 0%. */
export const UNSCORED_PROFILE_SIGNAL: MemberProfileSignal = {
  profileCompletenessPercent: null,
  profileAsOf: null,
};

/** Score the profile row when there is one; otherwise report nothing measured. */
export function toProfileSignal(
  rows: readonly ProfileCompletenessRow[],
): MemberProfileSignal {
  const row = rows[0];
  if (row === undefined) {
    return UNSCORED_PROFILE_SIGNAL;
  }
  return {
    profileCompletenessPercent: scoreProfileCompleteness(row),
    profileAsOf: toDate(row.updated_at),
  };
}

/**
 * Interpret a roster aggregate as a signal. An aggregate over an empty set still
 * returns one row with count 0; that means "nothing to report", so the signal is
 * null rather than a zero a client would render as a real measurement.
 */
export function toMemberCountSignal(
  rows: readonly MemberSignalCountRow[],
): MemberCountSignal {
  const row = rows[0];
  if (row === undefined || row.count === 0) {
    return { count: null, asOf: null };
  }
  return { count: row.count, asOf: toNullableDate(row.boundary_at) };
}
