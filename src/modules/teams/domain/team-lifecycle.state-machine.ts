import { TeamStatus } from '../model/teams.enums';

/**
 * Pure team lifecycle state machine.
 *
 *   active   -> disabled | archived
 *   disabled -> active   | archived
 *   archived -> active                (re-open a wound-down team)
 *
 * A team is never hard-deleted: soft removal is a separate, terminal step that
 * stamps `deleted_at` and is only permitted once the team is archived, so an
 * operating team can never be removed by a single call. No side effects, no
 * time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<TeamStatus, readonly TeamStatus[]> = new Map([
  [TeamStatus.Active, [TeamStatus.Disabled, TeamStatus.Archived]],
  [TeamStatus.Disabled, [TeamStatus.Active, TeamStatus.Archived]],
  [TeamStatus.Archived, [TeamStatus.Active]],
]);

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionTeam(from: TeamStatus, to: TeamStatus): boolean {
  if (from === to) {
    return false;
  }
  const targets = TRANSITIONS.get(from) ?? [];
  return targets.includes(to);
}

/** The states reachable from `from` in one transition. */
export function allowedTeamTransitions(
  from: TeamStatus,
): readonly TeamStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/**
 * Soft removal is only permitted from the archived end-state, and never twice:
 * an already-removed team (deletedAt set) is terminal.
 */
export function canRemoveTeam(
  status: TeamStatus,
  deletedAt: Date | null,
): boolean {
  return deletedAt === null && status === TeamStatus.Archived;
}

/**
 * Only an active team accepts new scoped work (seasons, venues, settings,
 * members). Disabled, archived and removed teams keep every historical row but
 * take no new writes.
 */
export function canAcceptTeamWork(
  status: TeamStatus,
  deletedAt: Date | null,
): boolean {
  return deletedAt === null && status === TeamStatus.Active;
}
