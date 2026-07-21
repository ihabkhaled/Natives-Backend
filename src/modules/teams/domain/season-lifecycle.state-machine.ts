import { SeasonStatus } from '../model/teams.enums';

/**
 * Pure season lifecycle state machine.
 *
 *   draft    -> active | archived
 *   active   -> closed | archived
 *   closed   -> active | archived     (re-open a season closed too early)
 *   archived -> draft                 (revive a season back to planning)
 *
 * Exactly one season per team may be `active`; that invariant is enforced by the
 * partial unique index `ux_seasons_one_active_per_team` and pre-checked in the
 * application layer so callers get a typed conflict instead of a driver error.
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<SeasonStatus, readonly SeasonStatus[]> = new Map(
  [
    [SeasonStatus.Draft, [SeasonStatus.Active, SeasonStatus.Archived]],
    [SeasonStatus.Active, [SeasonStatus.Closed, SeasonStatus.Archived]],
    [SeasonStatus.Closed, [SeasonStatus.Active, SeasonStatus.Archived]],
    [SeasonStatus.Archived, [SeasonStatus.Draft]],
  ],
);

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionSeason(
  from: SeasonStatus,
  to: SeasonStatus,
): boolean {
  if (from === to) {
    return false;
  }
  const targets = TRANSITIONS.get(from) ?? [];
  return targets.includes(to);
}

/** The states reachable from `from` in one transition. */
export function allowedSeasonTransitions(
  from: SeasonStatus,
): readonly SeasonStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/**
 * True when moving to `target` would claim the team's single "current season"
 * slot, so the caller must first prove no other season already holds it.
 */
export function claimsCurrentSeasonSlot(target: SeasonStatus): boolean {
  return target === SeasonStatus.Active;
}
