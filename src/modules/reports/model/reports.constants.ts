import type { ErrorMessageKey } from '@core/errors/error.types';

import {
  ReportFormat,
  ReportPrivacyClass,
  ReportTemplate,
} from './reports.enums';

// --- Ports -------------------------------------------------------------------

export const REPORT_DOCUMENT_PORT = Symbol('REPORT_DOCUMENT_PORT');
export const REPORT_DOWNLOAD_PORT = Symbol('REPORT_DOWNLOAD_PORT');

// --- API surface -------------------------------------------------------------

export const REPORTS_API_TAG = 'reports';
export const REPORTS_ROUTE = 'teams/:teamId/reports';

export const TEAM_ID_PARAM = 'teamId';
export const JOB_ID_PARAM = 'jobId';

export const REPORT_ITEM_ROUTE = ':jobId';
export const REPORT_DOWNLOAD_ROUTE = ':jobId/download';
export const REPORT_RETRY_ROUTE = ':jobId/retry';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

// --- Job policy --------------------------------------------------------------

export const CALCULATION_VERSION = 'reports-v1';
export const DOWNLOAD_TTL_SECONDS = 900;
export const JOB_EXPIRY_HOURS = 168;
export const MAX_RETRIES = 3;
export const MILLISECONDS_PER_HOUR = 3_600_000;
export const MILLISECONDS_PER_SECOND = 1000;
export const CHECKSUM_ALGORITHM = 'sha256';
export const SIGNATURE_ALGORITHM = 'sha256';
export const DOWNLOAD_METHOD = 'GET';
export const DOWNLOAD_BASE_URL = 'https://reports.ultimate-natives.local';

/** The default privacy class of each template. */
export const TEMPLATE_PRIVACY: ReadonlyMap<ReportTemplate, ReportPrivacyClass> =
  new Map([
    [ReportTemplate.PlayerPerformance, ReportPrivacyClass.Restricted],
    [ReportTemplate.TeamOverview, ReportPrivacyClass.Team],
    [ReportTemplate.Attendance, ReportPrivacyClass.Team],
    [ReportTemplate.TrainingLeaderboard, ReportPrivacyClass.Team],
    [ReportTemplate.Roster, ReportPrivacyClass.Team],
    [ReportTemplate.MatchSheet, ReportPrivacyClass.Public],
    [ReportTemplate.MatchStats, ReportPrivacyClass.Team],
    [ReportTemplate.Analysis, ReportPrivacyClass.Restricted],
    [ReportTemplate.TryoutFunnel, ReportPrivacyClass.Restricted],
    [ReportTemplate.DataQuality, ReportPrivacyClass.Restricted],
  ]);

/** The default format a template is generated in when none is requested. */
export const TEMPLATE_DEFAULT_FORMAT: ReadonlyMap<
  ReportTemplate,
  ReportFormat
> = new Map([
  [ReportTemplate.MatchSheet, ReportFormat.Pdf],
  [ReportTemplate.PlayerPerformance, ReportFormat.Pdf],
  [ReportTemplate.Analysis, ReportFormat.Pdf],
]);

// --- Field bounds ------------------------------------------------------------

export const PARAMETERS_MAX_KEYS = 20;
export const PARAMETER_VALUE_MAX_LENGTH = 200;
export const FAILURE_REASON_MAX_LENGTH = 500;

/** The characters that trigger CSV/XLSX formula injection when leading a cell. */
export const FORMULA_INJECTION_PREFIXES: readonly string[] = [
  '=',
  '+',
  '-',
  '@',
  '\t',
  '\r',
];
/** The prefix prepended to neutralize a would-be formula cell. */
export const FORMULA_ESCAPE_PREFIX = `'`;

// --- Error messages ----------------------------------------------------------

export const REPORT_JOB_NOT_FOUND_MESSAGE =
  'The requested report job was not found';
export const REPORT_JOB_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.jobNotFound';
export const REPORT_SCOPE_NOT_FOUND_MESSAGE =
  'The team or season scope was not found';
export const REPORT_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.scopeNotFound';
export const REPORT_VALIDATION_MESSAGE =
  'The report request failed a domain validation rule';
export const REPORT_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.validation';
export const REPORT_NOT_READY_MESSAGE =
  'The report is not completed and cannot be downloaded';
export const REPORT_NOT_READY_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.notReady';
export const REPORT_EXPIRED_MESSAGE =
  'The report download has expired; generate it again';
export const REPORT_EXPIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.expired';
export const REPORT_RETRY_NOT_ALLOWED_MESSAGE =
  'The report job cannot be retried in its current state';
export const REPORT_RETRY_NOT_ALLOWED_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.retryNotAllowed';
export const REPORT_VERSION_CONFLICT_MESSAGE =
  'The report job was modified concurrently';
export const REPORT_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.reports.versionConflict';

// --- Audit / events ----------------------------------------------------------

export const REPORT_RESOURCE_TYPE = 'report_job';
export const REPORT_REQUESTED_ACTION = 'report.requested';
export const REPORT_COMPLETED_ACTION = 'report.completed';
export const REPORT_DOWNLOADED_ACTION = 'report.downloaded';
export const REPORT_RETRIED_ACTION = 'report.retried';

// --- Static column lists (never SELECT *) ------------------------------------

export const REPORT_JOB_COLUMNS = `"id", "team_id", "season_id", "template",
  "format", "privacy_class", "parameters", "request_hash", "status",
  "progress", "retry_count", "calculation_version", "snapshot_at",
  "storage_reference", "checksum", "row_count", "failure_reason", "expires_at",
  "record_version", "requested_by", "started_at", "completed_at", "failed_at",
  "created_at", "updated_at"`;
