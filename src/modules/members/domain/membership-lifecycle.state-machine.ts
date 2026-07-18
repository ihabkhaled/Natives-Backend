import { MembershipStatus } from '../model/members.enums';

/**
 * Pure membership lifecycle state machine. Encodes the allowed transitions from
 * the product workflow (invite/activate/deactivate/suspend/leave/archive/
 * anonymize/restore). Historical facts remain linked in every non-active state;
 * `Anonymized` is a terminal, privileged retention end-state. No side effects,
 * no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<MembershipStatus, readonly MembershipStatus[]> =
  new Map([
    [
      MembershipStatus.Invited,
      [
        MembershipStatus.Active,
        MembershipStatus.Left,
        MembershipStatus.Archived,
        MembershipStatus.Anonymized,
      ],
    ],
    [
      MembershipStatus.Active,
      [
        MembershipStatus.Inactive,
        MembershipStatus.Suspended,
        MembershipStatus.Left,
        MembershipStatus.Archived,
        MembershipStatus.Anonymized,
      ],
    ],
    [
      MembershipStatus.Inactive,
      [
        MembershipStatus.Active,
        MembershipStatus.Suspended,
        MembershipStatus.Left,
        MembershipStatus.Archived,
        MembershipStatus.Anonymized,
      ],
    ],
    [
      MembershipStatus.Suspended,
      [
        MembershipStatus.Active,
        MembershipStatus.Left,
        MembershipStatus.Archived,
        MembershipStatus.Anonymized,
      ],
    ],
    [
      MembershipStatus.Left,
      [MembershipStatus.Archived, MembershipStatus.Anonymized],
    ],
    [
      MembershipStatus.Archived,
      [MembershipStatus.Active, MembershipStatus.Anonymized],
    ],
    [MembershipStatus.Anonymized, []],
  ]);

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransition(
  from: MembershipStatus,
  to: MembershipStatus,
): boolean {
  if (from === to) {
    return false;
  }
  const targets = TRANSITIONS.get(from) ?? [];
  return targets.includes(to);
}

/** The set of states reachable from `from` in one transition. */
export function allowedTransitions(
  from: MembershipStatus,
): readonly MembershipStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** Anonymized is terminal: no further transitions are permitted. */
export function isTerminal(status: MembershipStatus): boolean {
  return allowedTransitions(status).length === 0;
}

/**
 * Only an active membership may mutate its own team data (RSVP, submissions, …).
 * Inactive/suspended/left/archived/anonymized members retain history but cannot
 * act. Downstream modules call this before accepting a member-initiated write.
 */
export function canMutateTeamData(status: MembershipStatus): boolean {
  return status === MembershipStatus.Active;
}

/** Profile fields are immutable once a membership is anonymized (redacted). */
export function canEditProfile(status: MembershipStatus): boolean {
  return status !== MembershipStatus.Anonymized;
}

/** A member may edit their own profile only while active. */
export function canSelfEditProfile(status: MembershipStatus): boolean {
  return status === MembershipStatus.Active;
}
