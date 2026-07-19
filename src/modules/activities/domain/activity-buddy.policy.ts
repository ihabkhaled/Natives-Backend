import { ActivityValidationError } from '../errors/activity-validation.error';
import { BUDDIES_MAX_ITEMS } from '../model/activities.constants';
import { BuddyDecision, BuddyStatus } from '../model/activity.enums';

/**
 * Pure rules for training buddies. A buddy is a distinct co-participant membership
 * credited on one submission; membership-in-team is validated by the scope service
 * against the database. Here we enforce the shape-level invariants (no self-credit,
 * no duplicates, bounded count) and the confirmation state machine
 * (pending → confirmed/declined). No side effects, no time, no persistence.
 */

/**
 * Validate the buddy membership ids for a submission: no duplicates, none equal to
 * the submitter's own membership, and within the bounded maximum.
 */
export function assertBuddyMemberships(
  buddyMembershipIds: readonly string[],
  submitterMembershipId: string,
): void {
  if (buddyMembershipIds.length > BUDDIES_MAX_ITEMS) {
    throw new ActivityValidationError();
  }
  const unique = new Set(buddyMembershipIds);
  if (unique.size !== buddyMembershipIds.length) {
    throw new ActivityValidationError();
  }
  if (unique.has(submitterMembershipId)) {
    throw new ActivityValidationError();
  }
}

/**
 * The initial confirmation state of a new buddy link per the versioned policy:
 * `pending` when confirmation is required, otherwise auto-linked as `confirmed`.
 */
export function resolveInitialBuddyStatus(
  confirmationRequired: boolean,
): BuddyStatus {
  return confirmationRequired ? BuddyStatus.Pending : BuddyStatus.Confirmed;
}

/** Only a pending buddy credit can still be answered by the credited member. */
export function canRespondToBuddy(status: BuddyStatus): boolean {
  return status === BuddyStatus.Pending;
}

/** Map a credited member's decision to the resulting buddy state. */
export function resolveBuddyResponse(decision: BuddyDecision): BuddyStatus {
  return decision === BuddyDecision.Confirm
    ? BuddyStatus.Confirmed
    : BuddyStatus.Declined;
}
