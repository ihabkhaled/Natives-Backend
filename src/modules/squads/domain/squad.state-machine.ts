import { SquadStatus, SquadTransition } from '../model/squads.enums';

/**
 * Pure lifecycle state machine for a squad
 * (DRAFT → PUBLISHED → LOCKED → ARCHIVED, with REVISE returning a published or
 * locked squad to DRAFT so historical versions are preserved by a revision bump).
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<SquadStatus, readonly SquadStatus[]> = new Map([
  [SquadStatus.Draft, [SquadStatus.Published, SquadStatus.Archived]],
  [
    SquadStatus.Published,
    [SquadStatus.Locked, SquadStatus.Draft, SquadStatus.Archived],
  ],
  [SquadStatus.Locked, [SquadStatus.Draft, SquadStatus.Archived]],
  [SquadStatus.Archived, []],
]);

/** The set of states reachable from `from` in one transition. */
export function allowedSquadTransitions(
  from: SquadStatus,
): readonly SquadStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionSquad(
  from: SquadStatus,
  to: SquadStatus,
): boolean {
  return allowedSquadTransitions(from).includes(to);
}

/** Map a requested transition verb to the status it targets. */
export function resolveSquadTarget(transition: SquadTransition): SquadStatus {
  if (transition === SquadTransition.Publish) {
    return SquadStatus.Published;
  }
  if (transition === SquadTransition.Lock) {
    return SquadStatus.Locked;
  }
  if (transition === SquadTransition.Revise) {
    return SquadStatus.Draft;
  }
  return SquadStatus.Archived;
}

/** Publishing stamps a publication instant and actor and notifies. */
export function isPublishTarget(target: SquadStatus): boolean {
  return target === SquadStatus.Published;
}

/** Locking freezes the roster and stamps a lock instant. */
export function isLockTarget(target: SquadStatus): boolean {
  return target === SquadStatus.Locked;
}

/** Archiving stamps an archival instant. */
export function isArchiveTarget(target: SquadStatus): boolean {
  return target === SquadStatus.Archived;
}

/** Revising a published/locked squad returns it to DRAFT and bumps the revision. */
export function isReviseTransition(
  from: SquadStatus,
  target: SquadStatus,
): boolean {
  return target === SquadStatus.Draft && from !== SquadStatus.Draft;
}

/** A locked squad's selection is frozen; only a revise/archive changes it. */
export function isSelectionFrozen(status: SquadStatus): boolean {
  return status === SquadStatus.Locked || status === SquadStatus.Archived;
}
