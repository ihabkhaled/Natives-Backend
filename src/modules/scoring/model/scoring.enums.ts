/**
 * Enumerations for the versioned performance score engine (UN-303). Every enum
 * ships a `*_VALUES` tuple so mappers can validate a raw database string against
 * the closed set without a hand-maintained second list.
 */

/**
 * Lifecycle of a named calculation-rule version (mirrors the `points_rule`
 * state machine in 11-SCHEMAS/state-machines.yaml). A `draft` is the author's
 * editable working copy; `approved` is cleared for activation; `published` is the
 * single effective rule for its scope; `retired` is a superseded historical
 * version. A published or retired rule is never edited in place.
 */
export enum CalculationRuleStatus {
  Draft = 'draft',
  Approved = 'approved',
  Published = 'published',
  Retired = 'retired',
}

export const CALCULATION_RULE_STATUS_VALUES: readonly CalculationRuleStatus[] =
  Object.values(CalculationRuleStatus);

/** A requested lifecycle transition verb for a calculation rule. */
export enum CalculationRuleTransition {
  Approve = 'approve',
  Publish = 'publish',
  Retire = 'retire',
  Revert = 'revert',
}

export const CALCULATION_RULE_TRANSITION_VALUES: readonly CalculationRuleTransition[] =
  Object.values(CalculationRuleTransition);

/**
 * Materialization state of a performance-score projection. A projection is a
 * rebuildable cache of a computed score, never a hand-editable total: `stale`
 * needs recompute, `building` is mid-rebuild, `ready` is current, `failed`
 * captured a rebuild error for that member without aborting the batch.
 */
export enum ScoreProjectionStatus {
  Stale = 'stale',
  Building = 'building',
  Ready = 'ready',
  Failed = 'failed',
}

export const SCORE_PROJECTION_STATUS_VALUES: readonly ScoreProjectionStatus[] =
  Object.values(ScoreProjectionStatus);

/**
 * Data-completeness confidence band shown alongside a score so a player with
 * little assessed data is not falsely ranked against a fully-assessed one.
 */
export enum ScoreConfidence {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export const SCORE_CONFIDENCE_VALUES: readonly ScoreConfidence[] =
  Object.values(ScoreConfidence);

/**
 * The category component keys a rule may weight. Six map to published-assessment
 * categories; `attendance` is sourced separately and stays null (excluded, never
 * zero) until an attendance component feeds it — the legacy equal-weight overall
 * lists all seven.
 */
export enum ScoreCategory {
  Training = 'training',
  Technical = 'technical',
  Tactical = 'tactical',
  Physical = 'physical',
  Psychological = 'psychological',
  Behavioral = 'behavioral',
  Attendance = 'attendance',
}

export const SCORE_CATEGORY_VALUES: readonly ScoreCategory[] =
  Object.values(ScoreCategory);
