/**
 * Enumerations for standings, results, achievements, and team history (UN-506).
 * Every enum ships a `*_VALUES` tuple so mappers can validate a raw database
 * string against the closed set.
 */

/** Whether a standings row is our team or a recorded opponent. */
export enum StandingEntrantKind {
  Team = 'team',
  Opponent = 'opponent',
}

export const STANDING_ENTRANT_KIND_VALUES: readonly StandingEntrantKind[] =
  Object.values(StandingEntrantKind);

/** Where the row came from. Anything but `derived` needs a reconciliation note. */
export enum StandingSource {
  Derived = 'derived',
  Manual = 'manual',
  Import = 'import',
}

export const STANDING_SOURCE_VALUES: readonly StandingSource[] =
  Object.values(StandingSource);

/** The competition outcome of an entrant. `undecided` is honest, not "none". */
export enum StandingQualification {
  Undecided = 'undecided',
  Qualified = 'qualified',
  Eliminated = 'eliminated',
  Promoted = 'promoted',
  Relegated = 'relegated',
}

export const STANDING_QUALIFICATION_VALUES: readonly StandingQualification[] =
  Object.values(StandingQualification);

/**
 * The ordered tie-break criteria a rule version may cite. The list is data:
 * a rule version stores its own ordering, and a stored standings table is only
 * ever re-sorted by the version it was computed under.
 */
export enum StandingTieBreak {
  StandingPoints = 'standing_points',
  Wins = 'wins',
  PointDifference = 'point_difference',
  PointsFor = 'points_for',
  PointsAgainst = 'points_against',
  Spirit = 'spirit',
  Alphabetical = 'alphabetical',
}

export const STANDING_TIE_BREAK_VALUES: readonly StandingTieBreak[] =
  Object.values(StandingTieBreak);

/** Lifecycle of a standings rule version. Versions are immutable once written. */
export enum StandingRuleStatus {
  Active = 'active',
  Archived = 'archived',
}

export const STANDING_RULE_STATUS_VALUES: readonly StandingRuleStatus[] =
  Object.values(StandingRuleStatus);

/** The outcome of one finalized match from our team's point of view. */
export enum MatchOutcome {
  Win = 'win',
  Loss = 'loss',
  Draw = 'draw',
  Undecided = 'undecided',
}

export const MATCH_OUTCOME_VALUES: readonly MatchOutcome[] =
  Object.values(MatchOutcome);

/** What kind of achievement is being recorded. */
export enum AchievementCategory {
  Trophy = 'trophy',
  Placement = 'placement',
  Award = 'award',
  Milestone = 'milestone',
  Spirit = 'spirit',
  Participation = 'participation',
}

export const ACHIEVEMENT_CATEGORY_VALUES: readonly AchievementCategory[] =
  Object.values(AchievementCategory);

/** Who may see the achievement. `public` is the trophy cabinet. */
export enum AchievementVisibility {
  Public = 'public',
  Team = 'team',
  Staff = 'staff',
}

export const ACHIEVEMENT_VISIBILITY_VALUES: readonly AchievementVisibility[] =
  Object.values(AchievementVisibility);

/** Approval lifecycle of an achievement. Only `approved` reaches history. */
export enum AchievementStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Rejected = 'rejected',
  Archived = 'archived',
}

export const ACHIEVEMENT_STATUS_VALUES: readonly AchievementStatus[] =
  Object.values(AchievementStatus);

/** The lifecycle verbs the achievement transition endpoint accepts. */
export enum AchievementTransition {
  Submit = 'submit',
  Approve = 'approve',
  Reject = 'reject',
  Archive = 'archive',
}

export const ACHIEVEMENT_TRANSITION_VALUES: readonly AchievementTransition[] =
  Object.values(AchievementTransition);

/** Where an achievement came from. */
export enum AchievementSource {
  Manual = 'manual',
  Derived = 'derived',
  Import = 'import',
}

export const ACHIEVEMENT_SOURCE_VALUES: readonly AchievementSource[] =
  Object.values(AchievementSource);

/** The outcome recorded for one row of an audited achievement import. */
export enum AchievementImportOutcome {
  Imported = 'imported',
  SkippedDuplicate = 'skipped_duplicate',
  RejectedInvalid = 'rejected_invalid',
}

export const ACHIEVEMENT_IMPORT_OUTCOME_VALUES: readonly AchievementImportOutcome[] =
  Object.values(AchievementImportOutcome);
