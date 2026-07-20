import {
  EntryFlagCode,
  RosterAvailabilityStatus,
  RosterMemberStatus,
} from '../model/rosters.enums';
import type { RosterCandidate, RosterOverride } from '../model/rosters.types';

/**
 * Pure entry-eligibility rules (UN-502). A flag NEVER removes anyone from a
 * roster automatically: it forces the decision to be a conscious, permitted
 * human's, recorded with a reason and audited. This module decides only whether
 * an override is required and whether one was supplied — it never selects or
 * rejects on its own. No side effects, no persistence.
 */

/**
 * Every reason this candidate needs an explicit override, in a deterministic
 * order. `requiresSquad` is true when the roster was drawn from a season squad —
 * only then is "not in the squad" meaningful.
 */
export function evaluateEntryFlags(
  candidate: RosterCandidate,
  requiresSquad: boolean,
): readonly EntryFlagCode[] {
  return [
    ...statusFlags(candidate.memberStatus),
    ...availabilityFlags(candidate.availability),
    ...squadFlags(candidate.selectedInSquad, requiresSquad),
  ];
}

/** True when at least one rule flags the candidate. */
export function isEntryFlagged(flags: readonly EntryFlagCode[]): boolean {
  return flags.length > 0;
}

/** True when adding this candidate is blocked for lack of a required override. */
export function isEntryOverrideMissing(
  flags: readonly EntryFlagCode[],
  override: RosterOverride | null,
): boolean {
  return isEntryFlagged(flags) && override === null;
}

/**
 * True when an override was actually exercised: a reason attached to a candidate
 * that no rule flagged is recorded as ordinary selection, not as an override, so
 * override evidence always means a real accepted flag.
 */
export function isOverrideExercised(
  flags: readonly EntryFlagCode[],
  override: RosterOverride | null,
): boolean {
  return override !== null && isEntryFlagged(flags);
}

/** A compact, privacy-safe summary of the accepted flags for the audit trail. */
export function summarizeEntryFlags(flags: readonly EntryFlagCode[]): string {
  return flags.join(',');
}

function statusFlags(status: RosterMemberStatus): readonly EntryFlagCode[] {
  if (status === RosterMemberStatus.Suspended) {
    return [EntryFlagCode.MembershipSuspended];
  }
  if (
    status === RosterMemberStatus.Active ||
    status === RosterMemberStatus.Invited
  ) {
    return [];
  }
  return [EntryFlagCode.MembershipInactive];
}

function availabilityFlags(
  availability: RosterAvailabilityStatus | null,
): readonly EntryFlagCode[] {
  return availability === RosterAvailabilityStatus.Unavailable
    ? [EntryFlagCode.DeclaredUnavailable]
    : [];
}

function squadFlags(
  selectedInSquad: boolean,
  requiresSquad: boolean,
): readonly EntryFlagCode[] {
  return requiresSquad && !selectedInSquad ? [EntryFlagCode.NotInSquad] : [];
}
