/**
 * Enumerations for the append-only points system (UN-402). Every enum ships a
 * `*_VALUES` tuple so mappers can validate a raw database string against the
 * closed set without a hand-maintained second list.
 */

/**
 * Lifecycle of a named points-rule version (mirrors the `points_rule` state
 * machine in 11-SCHEMAS/state-machines.yaml). A `draft` is the author's editable
 * working copy; `approved` is cleared for activation; `published` is the single
 * effective rule for its scope; `retired` is a superseded historical version. A
 * published or retired rule is never edited in place.
 */
export enum PointsRuleStatus {
  Draft = 'draft',
  Approved = 'approved',
  Published = 'published',
  Retired = 'retired',
}

export const POINTS_RULE_STATUS_VALUES: readonly PointsRuleStatus[] =
  Object.values(PointsRuleStatus);

/** A requested lifecycle transition verb for a points rule. */
export enum PointsRuleTransition {
  Approve = 'approve',
  Publish = 'publish',
  Retire = 'retire',
  Revert = 'revert',
}

export const POINTS_RULE_TRANSITION_VALUES: readonly PointsRuleTransition[] =
  Object.values(PointsRuleTransition);

/**
 * The kind of an immutable ledger entry. AWARD credits a member for an approved
 * activity; REVERSAL is a compensating negative row that never edits the award it
 * offsets; MANUAL_ADJUSTMENT and IMPORT_ADJUSTMENT are audited administrative and
 * migration corrections; EXPIRY debits stale points under a future policy.
 */
export enum LedgerEntryType {
  Award = 'award',
  Reversal = 'reversal',
  ManualAdjustment = 'manual_adjustment',
  ImportAdjustment = 'import_adjustment',
  Expiry = 'expiry',
}

export const LEDGER_ENTRY_TYPE_VALUES: readonly LedgerEntryType[] =
  Object.values(LedgerEntryType);

/** The origin an entry is attributed to for audit and reconciliation. */
export enum LedgerSourceType {
  ActivitySubmission = 'activity_submission',
  Manual = 'manual',
  Import = 'import',
  System = 'system',
}

export const LEDGER_SOURCE_TYPE_VALUES: readonly LedgerSourceType[] =
  Object.values(LedgerSourceType);

/**
 * Approval state of an activity type's candidate point value (mirrors the
 * activities catalog). Only `approved` types award points; a `pending` type is
 * never guessed into a value (null-not-zero).
 */
export enum PointsApproval {
  Approved = 'approved',
  Pending = 'pending',
}

export const POINTS_APPROVAL_VALUES: readonly PointsApproval[] =
  Object.values(PointsApproval);

/**
 * Why the pure award calculator withheld an award. `None` means a value was
 * awarded; the rest are the deterministic skip branches: the rule has no entry
 * for the activity, the activity's value is pending/unset, or a per-type daily cap
 * or cooldown blocked this occurrence. Never a silent zero.
 */
export enum AwardSkipReason {
  None = 'none',
  NoRuleEntry = 'no_rule_entry',
  PendingApproval = 'pending_approval',
  NoValue = 'no_value',
  Cap = 'cap',
  Cooldown = 'cooldown',
}

export const AWARD_SKIP_REASON_VALUES: readonly AwardSkipReason[] =
  Object.values(AwardSkipReason);

/**
 * Lifecycle of a badge definition. Legacy tier thresholds are seeded as
 * `needs_approval` CANDIDATES and the broken `#REF!` tier as `disabled`; only an
 * `active` definition is ever awarded, so unresolved badge data is never guessed.
 */
export enum BadgeStatus {
  Candidate = 'candidate',
  NeedsApproval = 'needs_approval',
  Active = 'active',
  Disabled = 'disabled',
}

export const BADGE_STATUS_VALUES: readonly BadgeStatus[] =
  Object.values(BadgeStatus);
