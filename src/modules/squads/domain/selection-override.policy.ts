import { SignalStatus } from '../model/squads.enums';
import type {
  MemberEligibility,
  SelectionOverride,
} from '../model/squads.types';

/**
 * Pure override policy for squad selection (UN-501). An eligibility signal never
 * excludes a player — but selecting a candidate that a signal FLAGS requires an
 * explicit human override with a reason (and, at the API edge, the
 * `squad.override_eligibility` permission). This function decides only whether an
 * override is required and whether one was supplied; it never selects or rejects
 * on its own. No side effects, no persistence.
 */

/** A flagged candidate (Failed or Warning overall) needs an explicit override. */
export function requiresOverride(eligibility: MemberEligibility): boolean {
  return eligibility.flagged;
}

/** True when selecting this candidate is blocked for lack of a required override. */
export function isOverrideMissing(
  eligibility: MemberEligibility,
  override: SelectionOverride | null,
): boolean {
  return requiresOverride(eligibility) && override === null;
}

/**
 * The eligibility outcome to persist as the selection snapshot: `Overridden` when
 * a flagged candidate is accepted via override, otherwise the computed overall.
 * Keeps the recorded outcome faithful to how the human decision was made.
 */
export function resolvedSelectionOutcome(
  eligibility: MemberEligibility,
  override: SelectionOverride | null,
): SignalStatus {
  if (override !== null && eligibility.flagged) {
    return SignalStatus.Overridden;
  }
  return eligibility.overall;
}
