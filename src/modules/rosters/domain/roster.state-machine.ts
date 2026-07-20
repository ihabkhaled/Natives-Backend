import { RosterStatus, RosterTransition } from '../model/rosters.enums';

/**
 * Pure lifecycle state machine for a roster
 * (DRAFT → PUBLISHED → LOCKED → REVISED → ARCHIVED).
 *
 * REVISED is a superseded state, not an editable one: reopening a published or
 * locked roster moves it to REVISED (with a mandatory reason) and produces a NEW
 * successor roster, so the frozen record and its snapshot are never rewritten.
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<RosterStatus, readonly RosterStatus[]> = new Map(
  [
    [RosterStatus.Draft, [RosterStatus.Published, RosterStatus.Archived]],
    [
      RosterStatus.Published,
      [RosterStatus.Locked, RosterStatus.Revised, RosterStatus.Archived],
    ],
    [RosterStatus.Locked, [RosterStatus.Revised, RosterStatus.Archived]],
    [RosterStatus.Revised, [RosterStatus.Archived]],
    [RosterStatus.Archived, []],
  ],
);

/** The set of states reachable from `from` in one transition. */
export function allowedRosterTransitions(
  from: RosterStatus,
): readonly RosterStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionRoster(
  from: RosterStatus,
  to: RosterStatus,
): boolean {
  return allowedRosterTransitions(from).includes(to);
}

/** Map a plain transition verb (publish/archive) to the status it targets. */
export function resolveRosterTarget(
  transition: RosterTransition,
): RosterStatus {
  return transition === RosterTransition.Publish
    ? RosterStatus.Published
    : RosterStatus.Archived;
}

/** Publishing stamps a publication instant and actor and notifies. */
export function isPublishTarget(target: RosterStatus): boolean {
  return target === RosterStatus.Published;
}

/** Locking freezes the selection and stamps a lock instant and actor. */
export function isLockTarget(target: RosterStatus): boolean {
  return target === RosterStatus.Locked;
}

/** Archiving stamps an archival instant. */
export function isArchiveTarget(target: RosterStatus): boolean {
  return target === RosterStatus.Archived;
}

/** Superseding stamps the revision instant, actor, and mandatory reason. */
export function isReviseTarget(target: RosterStatus): boolean {
  return target === RosterStatus.Revised;
}

/**
 * A roster's entries may only change while it is still being selected. Locked,
 * revised, and archived rosters are frozen — the only way forward is a revision
 * that supersedes them.
 */
export function isRosterFrozen(status: RosterStatus): boolean {
  return (
    status === RosterStatus.Locked ||
    status === RosterStatus.Revised ||
    status === RosterStatus.Archived
  );
}

/** Only a published or locked roster can be superseded by a revision. */
export function isRevisable(status: RosterStatus): boolean {
  return status === RosterStatus.Published || status === RosterStatus.Locked;
}

/** Constraints are enforced (not merely previewed) when freezing a roster. */
export function enforcesConstraints(target: RosterStatus): boolean {
  return isPublishTarget(target) || isLockTarget(target);
}
