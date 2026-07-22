/**
 * Enumerations for data-quality rules, anomaly queues, and repairs (UN-705).
 * Every enum ships a `*_VALUES` tuple so mappers can validate a raw database
 * string against the closed set.
 */

/** The named detection rules. */
export enum DataQualityRule {
  DuplicateIdentity = 'duplicate_identity',
  JerseyConflict = 'jersey_conflict',
  SessionRosterGap = 'session_roster_gap',
  AttendanceAfterCancellation = 'attendance_after_cancellation',
  AssessmentOutOfScale = 'assessment_out_of_scale',
  LedgerSourceMismatch = 'ledger_source_mismatch',
  OrphanPoints = 'orphan_points',
  ScoreEventMismatch = 'score_event_mismatch',
  StaleProjection = 'stale_projection',
  MissingAlias = 'missing_alias',
}

export const DATA_QUALITY_RULE_VALUES: readonly DataQualityRule[] =
  Object.values(DataQualityRule);

export enum AnomalySeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

export const ANOMALY_SEVERITY_VALUES: readonly AnomalySeverity[] =
  Object.values(AnomalySeverity);

/** Lifecycle of an anomaly in the queue. */
export enum AnomalyStatus {
  Open = 'open',
  Acknowledged = 'acknowledged',
  Resolved = 'resolved',
  Suppressed = 'suppressed',
}

export const ANOMALY_STATUS_VALUES: readonly AnomalyStatus[] =
  Object.values(AnomalyStatus);

/** The verbs the anomaly transition endpoint accepts. */
export enum AnomalyTransition {
  Acknowledge = 'acknowledge',
  Resolve = 'resolve',
  Suppress = 'suppress',
  Reopen = 'reopen',
}

export const ANOMALY_TRANSITION_VALUES: readonly AnomalyTransition[] =
  Object.values(AnomalyTransition);

/** The kind of repair a rule supports. */
export enum RepairKind {
  MergeDuplicate = 'merge_duplicate',
  ReleaseJersey = 'release_jersey',
  BackfillProjection = 'backfill_projection',
  ReverseOrphanPoints = 'reverse_orphan_points',
  LinkAlias = 'link_alias',
}

export const REPAIR_KIND_VALUES: readonly RepairKind[] =
  Object.values(RepairKind);

/** Lifecycle of a repair — always terminal. */
export enum RepairStatus {
  Previewed = 'previewed',
  Applied = 'applied',
  RolledBack = 'rolled_back',
  Failed = 'failed',
}

export const REPAIR_STATUS_VALUES: readonly RepairStatus[] =
  Object.values(RepairStatus);

/** The resource an anomaly references (ids only, never a payload). */
export enum AnomalyResourceType {
  Membership = 'membership',
  Reservation = 'reservation',
  Session = 'session',
  Attendance = 'attendance',
  Assessment = 'assessment',
  LedgerEntry = 'ledger_entry',
  Match = 'match',
  Projection = 'projection',
  Alias = 'alias',
}

export const ANOMALY_RESOURCE_TYPE_VALUES: readonly AnomalyResourceType[] =
  Object.values(AnomalyResourceType);
