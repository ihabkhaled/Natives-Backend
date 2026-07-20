import {
  CompetitionStatus,
  CompetitionTransition,
} from '../model/competitions.enums';

/**
 * Pure lifecycle state machine for a competition
 * (DRAFT → PUBLISHED → ACTIVE → COMPLETED → ARCHIVED, with CANCELLED reachable
 * from any live state and archivable afterwards). Cancellation preserves every
 * historical stage/round/fixture — it is a status change, never a delete. No side
 * effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<
  CompetitionStatus,
  readonly CompetitionStatus[]
> = new Map([
  [
    CompetitionStatus.Draft,
    [CompetitionStatus.Published, CompetitionStatus.Cancelled],
  ],
  [
    CompetitionStatus.Published,
    [CompetitionStatus.Active, CompetitionStatus.Cancelled],
  ],
  [
    CompetitionStatus.Active,
    [CompetitionStatus.Completed, CompetitionStatus.Cancelled],
  ],
  [CompetitionStatus.Completed, [CompetitionStatus.Archived]],
  [CompetitionStatus.Cancelled, [CompetitionStatus.Archived]],
  [CompetitionStatus.Archived, []],
]);

/** The set of states reachable from `from` in one transition. */
export function allowedCompetitionTransitions(
  from: CompetitionStatus,
): readonly CompetitionStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionCompetition(
  from: CompetitionStatus,
  to: CompetitionStatus,
): boolean {
  return allowedCompetitionTransitions(from).includes(to);
}

/** Map a requested transition verb to the status it targets. */
export function resolveCompetitionTarget(
  transition: CompetitionTransition,
): CompetitionStatus {
  if (transition === CompetitionTransition.Publish) {
    return CompetitionStatus.Published;
  }
  if (transition === CompetitionTransition.Activate) {
    return CompetitionStatus.Active;
  }
  if (transition === CompetitionTransition.Complete) {
    return CompetitionStatus.Completed;
  }
  if (transition === CompetitionTransition.Cancel) {
    return CompetitionStatus.Cancelled;
  }
  return CompetitionStatus.Archived;
}

/** Publishing stamps a publication instant and actor. */
export function isPublishTarget(target: CompetitionStatus): boolean {
  return target === CompetitionStatus.Published;
}

/** Activation stamps an activation instant. */
export function isActivateTarget(target: CompetitionStatus): boolean {
  return target === CompetitionStatus.Active;
}

/** Completion stamps a completion instant. */
export function isCompleteTarget(target: CompetitionStatus): boolean {
  return target === CompetitionStatus.Completed;
}

/** Cancellation stamps a cancellation instant and requires a reason. */
export function isCancelTarget(target: CompetitionStatus): boolean {
  return target === CompetitionStatus.Cancelled;
}

/** Archiving stamps an archival instant. */
export function isArchiveTarget(target: CompetitionStatus): boolean {
  return target === CompetitionStatus.Archived;
}
