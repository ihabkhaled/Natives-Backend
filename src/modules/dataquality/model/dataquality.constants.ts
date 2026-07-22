import type { ErrorMessageKey } from '@core/errors/error.types';

import {
  AnomalySeverity,
  DataQualityRule,
  RepairKind,
} from './dataquality.enums';

// --- API surface -------------------------------------------------------------

export const DATA_QUALITY_API_TAG = 'data-quality';
export const ANOMALIES_ROUTE = 'teams/:teamId/data-quality/anomalies';
export const SCAN_ROUTE = 'teams/:teamId/data-quality/scan';

export const TEAM_ID_PARAM = 'teamId';
export const ANOMALY_ID_PARAM = 'anomalyId';

export const ANOMALY_ITEM_ROUTE = ':anomalyId';
export const ANOMALY_TRANSITION_ROUTE = ':anomalyId/transition';
export const ANOMALY_REPAIR_PREVIEW_ROUTE = ':anomalyId/repair-preview';
export const ANOMALY_REPAIR_APPLY_ROUTE = ':anomalyId/repair-apply';
export const REPAIR_ROLLBACK_ROUTE = ':anomalyId/repair-rollback';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const SCAN_MAX_ANOMALIES = 1000;

// --- Policy ------------------------------------------------------------------

export const RULE_VERSION = 'dq-v1';
/** The resolution note written when an anomaly is closed by an applied repair. */
export const RESOLVED_BY_REPAIR = 'Resolved by applied repair';
export const DEFAULT_SUPPRESSION_HOURS = 168;
export const STALE_PROJECTION_HOURS = 24;
export const SCAN_RULE_COUNT = 3;
export const MILLISECONDS_PER_HOUR = 3_600_000;

/** Only these severities produce an actionable alert. */
export const ALERTABLE_SEVERITIES: readonly AnomalySeverity[] = [
  AnomalySeverity.Warning,
  AnomalySeverity.Critical,
];

/** The severity each rule reports at. */
export const RULE_SEVERITY: ReadonlyMap<DataQualityRule, AnomalySeverity> =
  new Map([
    [DataQualityRule.DuplicateIdentity, AnomalySeverity.Critical],
    [DataQualityRule.JerseyConflict, AnomalySeverity.Warning],
    [DataQualityRule.AttendanceAfterCancellation, AnomalySeverity.Warning],
    [DataQualityRule.AssessmentOutOfScale, AnomalySeverity.Critical],
    [DataQualityRule.LedgerSourceMismatch, AnomalySeverity.Critical],
    [DataQualityRule.OrphanPoints, AnomalySeverity.Warning],
    [DataQualityRule.ScoreEventMismatch, AnomalySeverity.Warning],
    [DataQualityRule.StaleProjection, AnomalySeverity.Info],
    [DataQualityRule.MissingAlias, AnomalySeverity.Info],
    [DataQualityRule.SessionRosterGap, AnomalySeverity.Info],
  ]);

/** The repair kind each rule supports (when any). */
export const RULE_REPAIR: ReadonlyMap<DataQualityRule, RepairKind> = new Map([
  [DataQualityRule.DuplicateIdentity, RepairKind.MergeDuplicate],
  [DataQualityRule.JerseyConflict, RepairKind.ReleaseJersey],
  [DataQualityRule.StaleProjection, RepairKind.BackfillProjection],
  [DataQualityRule.OrphanPoints, RepairKind.ReverseOrphanPoints],
  [DataQualityRule.MissingAlias, RepairKind.LinkAlias],
]);

// --- Field bounds ------------------------------------------------------------

export const REF_MAX_LENGTH = 200;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 1000;
export const RECORD_VERSION_MIN = 1;

// --- Error messages ----------------------------------------------------------

export const ANOMALY_NOT_FOUND_MESSAGE = 'The requested anomaly was not found';
export const ANOMALY_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.dataQuality.anomalyNotFound';
export const DATA_QUALITY_SCOPE_NOT_FOUND_MESSAGE =
  'The team scope was not found';
export const DATA_QUALITY_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.dataQuality.scopeNotFound';
export const DATA_QUALITY_VALIDATION_MESSAGE =
  'The data-quality request failed a domain validation rule';
export const DATA_QUALITY_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.dataQuality.validation';
export const ANOMALY_INVALID_TRANSITION_MESSAGE =
  'The anomaly cannot make this lifecycle transition';
export const ANOMALY_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.dataQuality.invalidTransition';
export const REPAIR_NOT_ALLOWED_MESSAGE =
  'This anomaly does not support a repair, or the repair is not in a runnable state';
export const REPAIR_NOT_ALLOWED_MESSAGE_KEY: ErrorMessageKey =
  'errors.dataQuality.repairNotAllowed';
export const DATA_QUALITY_VERSION_CONFLICT_MESSAGE =
  'The record was modified concurrently';
export const DATA_QUALITY_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.dataQuality.versionConflict';

// --- Audit / events ----------------------------------------------------------

export const ANOMALY_RESOURCE_TYPE = 'data_quality_anomaly';
export const REPAIR_RESOURCE_TYPE = 'data_quality_repair';

export const SCAN_COMPLETED_ACTION = 'data_quality.scan.completed';
export const ANOMALY_TRANSITIONED_ACTION = 'data_quality.anomaly.transitioned';
export const REPAIR_PREVIEWED_ACTION = 'data_quality.repair.previewed';
export const REPAIR_APPLIED_ACTION = 'data_quality.repair.applied';
export const REPAIR_ROLLED_BACK_ACTION = 'data_quality.repair.rolled_back';

// --- Static column lists (never SELECT *) ------------------------------------

export const ANOMALY_COLUMNS = `"id", "team_id", "rule_key", "rule_version",
  "severity", "resource_type", "resource_ref", "fingerprint",
  "occurrence_count", "status", "owner_user_id", "resolution",
  "suppressed_until", "record_version", "first_seen_at", "last_seen_at",
  "resolved_at", "created_at", "updated_at"`;

export const REPAIR_COLUMNS = `"id", "team_id", "anomaly_id", "repair_kind",
  "status", "impact_count", "impact_summary", "rollback_ref", "record_version",
  "requested_by", "applied_at", "rolled_back_at", "created_at", "updated_at"`;

// --- Prepared statements -----------------------------------------------------

/**
 * Fingerprint-keyed upsert: re-detecting the same finding bumps its last-seen
 * instant and occurrence count and reopens a resolved or expired-suppressed row,
 * so a finding is never silently closed while the underlying data is still wrong.
 */
export const ANOMALY_UPSERT_SQL = `INSERT INTO "data_quality_anomalies"
    ("id", "team_id", "rule_key", "rule_version", "severity",
     "resource_type", "resource_ref", "fingerprint", "first_seen_at",
     "last_seen_at", "created_at", "updated_at")
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9, $9)
   ON CONFLICT ("team_id", "fingerprint") DO UPDATE SET
     "last_seen_at" = EXCLUDED."last_seen_at",
     "occurrence_count" = "data_quality_anomalies"."occurrence_count" + 1,
     "rule_version" = EXCLUDED."rule_version",
     "severity" = EXCLUDED."severity",
     "status" = CASE
       WHEN "data_quality_anomalies"."status" = 'resolved'
         OR ("data_quality_anomalies"."status" = 'suppressed'
             AND ("data_quality_anomalies"."suppressed_until" IS NULL
                  OR "data_quality_anomalies"."suppressed_until"
                     <= EXCLUDED."last_seen_at"))
       THEN 'open'
       ELSE "data_quality_anomalies"."status" END,
     "resolved_at" = NULL,
     "updated_at" = EXCLUDED."updated_at",
     "record_version" = "data_quality_anomalies"."record_version" + 1
   RETURNING ${ANOMALY_COLUMNS}`;
