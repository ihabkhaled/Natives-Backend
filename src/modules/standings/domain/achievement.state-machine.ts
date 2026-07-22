import {
  AchievementStatus,
  AchievementTransition,
  AchievementVisibility,
} from '../model/standings.enums';

/**
 * The achievement approval state machine (UN-506). Pure and total.
 *
 *   draft ──submit──▶ submitted ──approve──▶ approved ──archive──▶ archived
 *                          └────reject────▶ rejected
 *
 * Only an `approved` achievement is history: the trophy cabinet reads approved
 * rows and nothing else, so an unreviewed claim can never appear as a fact.
 * `rejected` and `archived` are terminal — a rejected claim is re-submitted as a
 * new record rather than quietly flipped back.
 */
const ALLOWED: ReadonlyMap<AchievementStatus, readonly AchievementStatus[]> =
  new Map([
    [AchievementStatus.Draft, [AchievementStatus.Submitted]],
    [
      AchievementStatus.Submitted,
      [AchievementStatus.Approved, AchievementStatus.Rejected],
    ],
    [AchievementStatus.Approved, [AchievementStatus.Archived]],
    [AchievementStatus.Rejected, []],
    [AchievementStatus.Archived, []],
  ]);

const TRANSITION_TARGETS: ReadonlyMap<
  AchievementTransition,
  AchievementStatus
> = new Map([
  [AchievementTransition.Submit, AchievementStatus.Submitted],
  [AchievementTransition.Approve, AchievementStatus.Approved],
  [AchievementTransition.Reject, AchievementStatus.Rejected],
  [AchievementTransition.Archive, AchievementStatus.Archived],
]);

export function targetStatusOf(
  transition: AchievementTransition,
): AchievementStatus {
  return TRANSITION_TARGETS.get(transition) ?? AchievementStatus.Draft;
}

export function canTransitionAchievement(
  from: AchievementStatus,
  to: AchievementStatus,
): boolean {
  return (ALLOWED.get(from) ?? []).includes(to);
}

/** Whether the achievement counts as team history. */
export function isHistoricAchievement(status: AchievementStatus): boolean {
  return status === AchievementStatus.Approved;
}

export function isApproveTarget(status: AchievementStatus): boolean {
  return status === AchievementStatus.Approved;
}

export function isRejectTarget(status: AchievementStatus): boolean {
  return status === AchievementStatus.Rejected;
}

export function isArchiveTarget(status: AchievementStatus): boolean {
  return status === AchievementStatus.Archived;
}

/**
 * Whether an approved achievement may be shown to a caller who is outside the
 * coaching staff. `staff` visibility never reaches the public cabinet even once
 * approved — approval decides truth, visibility decides audience.
 */
export function isPubliclyVisible(visibility: AchievementVisibility): boolean {
  return visibility === AchievementVisibility.Public;
}

export function isTeamVisible(visibility: AchievementVisibility): boolean {
  return visibility !== AchievementVisibility.Staff;
}
