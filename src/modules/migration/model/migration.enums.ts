/**
 * Enumerations for the legacy migration pipeline (UN-702, UN-703, UN-704). Every
 * enum ships a `*_VALUES` tuple so mappers can validate a raw database string
 * against the closed set.
 */

/** The audited workbooks the import framework maps. */
export enum WorkbookType {
  Assessments = 'assessments',
  MatchAnalysis = 'match_analysis',
  Jerseys = 'jerseys',
  AchievementsPoints = 'achievements_points',
  MatchStats = 'match_stats',
  Rules = 'rules',
  Tryouts = 'tryouts',
  Players2025 = 'players_2025',
}

export const WORKBOOK_TYPE_VALUES: readonly WorkbookType[] =
  Object.values(WorkbookType);

/** Lifecycle of an import job — always ends in a terminal state. */
export enum ImportStatus {
  Staged = 'staged',
  Validated = 'validated',
  Committed = 'committed',
  Failed = 'failed',
  Reversed = 'reversed',
}

export const IMPORT_STATUS_VALUES: readonly ImportStatus[] =
  Object.values(ImportStatus);

/** The outcome recorded for one imported row. */
export enum RowOutcome {
  Staged = 'staged',
  Committed = 'committed',
  SkippedDuplicate = 'skipped_duplicate',
  Error = 'error',
  Quarantined = 'quarantined',
}

export const ROW_OUTCOME_VALUES: readonly RowOutcome[] =
  Object.values(RowOutcome);

/** The entity action a committed row performed. */
export enum RowAction {
  None = 'none',
  Created = 'created',
  Updated = 'updated',
  Reversed = 'reversed',
}

export const ROW_ACTION_VALUES: readonly RowAction[] = Object.values(RowAction);

/** Review lifecycle of a legacy alias resolution. */
export enum AliasResolutionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
  Quarantined = 'quarantined',
}

export const ALIAS_RESOLUTION_STATUS_VALUES: readonly AliasResolutionStatus[] =
  Object.values(AliasResolutionStatus);

/** Where a legacy alias came from. */
export enum AliasSource {
  Import = 'import',
  Manual = 'manual',
}

export const ALIAS_SOURCE_VALUES: readonly AliasSource[] =
  Object.values(AliasSource);

/** How a target-vs-legacy formula difference is classified (UN-704). */
export enum DiscrepancyClassification {
  Matching = 'matching',
  TargetBug = 'target_bug',
  LegacyDefect = 'legacy_defect',
  BrokenReference = 'broken_reference',
  FixedRangeOmission = 'fixed_range_omission',
  Cleaning = 'cleaning',
  MissingVsZero = 'missing_vs_zero',
  VersionDifference = 'version_difference',
  Rounding = 'rounding',
  PrivacyExclusion = 'privacy_exclusion',
}

export const DISCREPANCY_CLASSIFICATION_VALUES: readonly DiscrepancyClassification[] =
  Object.values(DiscrepancyClassification);

/** The reason a source cell was rejected during parsing. */
export enum CellIssue {
  BrokenReference = 'broken_reference',
  NotAvailable = 'not_available',
  BlankVsZero = 'blank_vs_zero',
  FormulaInjection = 'formula_injection',
  InvalidDate = 'invalid_date',
}

export const CELL_ISSUE_VALUES: readonly CellIssue[] = Object.values(CellIssue);
