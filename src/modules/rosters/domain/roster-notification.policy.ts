import { RosterAudience, RosterKind } from '../model/rosters.enums';
import type { RosterAudiencePlan } from '../model/rosters.types';

/**
 * Pure publish-notification policy (UN-502). Publishing a roster tells the people
 * it affects — but privacy-aware: a COMPETITION roster is the selection decision
 * for the whole season squad, so both the selected and the not-selected are told
 * (the not-selected are told only that the roster is out, never who displaced
 * them). A MATCH roster is an operational line-up for people already selected, so
 * only its own players are notified; broadcasting "you are not playing this
 * match" to the rest of the squad is noise, not information.
 *
 * A roster with nobody on it notifies nobody. No side effects, no persistence —
 * the decision is carried on the published domain event for the platform
 * projection to fan out.
 */
export function resolvePublishAudience(
  kind: RosterKind,
  selectedCount: number,
  notSelectedCount: number,
): RosterAudiencePlan {
  return {
    audience: resolveAudience(kind, selectedCount),
    selectedCount,
    notSelectedCount,
  };
}

/** True when the plan reaches the players named on the roster. */
export function notifiesSelected(plan: RosterAudiencePlan): boolean {
  return plan.audience !== RosterAudience.None;
}

/** True when the plan also reaches squad members left off the roster. */
export function notifiesNotSelected(plan: RosterAudiencePlan): boolean {
  return plan.audience === RosterAudience.SelectedAndNotSelected;
}

function resolveAudience(
  kind: RosterKind,
  selectedCount: number,
): RosterAudience {
  if (selectedCount === 0) {
    return RosterAudience.None;
  }
  return kind === RosterKind.Competition
    ? RosterAudience.SelectedAndNotSelected
    : RosterAudience.SelectedOnly;
}
