/**
 * Enumerations for the report catalog and asynchronous generation (UN-701).
 * Every enum ships a `*_VALUES` tuple so mappers can validate a raw database
 * string against the closed set.
 */

/** The catalogue of report templates. */
export enum ReportTemplate {
  PlayerPerformance = 'player_performance',
  TeamOverview = 'team_overview',
  Attendance = 'attendance',
  TrainingLeaderboard = 'training_leaderboard',
  Roster = 'roster',
  MatchSheet = 'match_sheet',
  MatchStats = 'match_stats',
  Analysis = 'analysis',
  TryoutFunnel = 'tryout_funnel',
  DataQuality = 'data_quality',
}

export const REPORT_TEMPLATE_VALUES: readonly ReportTemplate[] =
  Object.values(ReportTemplate);

export enum ReportFormat {
  Csv = 'csv',
  Xlsx = 'xlsx',
  Pdf = 'pdf',
}

export const REPORT_FORMAT_VALUES: readonly ReportFormat[] =
  Object.values(ReportFormat);

export enum ReportPrivacyClass {
  Public = 'public',
  Team = 'team',
  Restricted = 'restricted',
}

export const REPORT_PRIVACY_CLASS_VALUES: readonly ReportPrivacyClass[] =
  Object.values(ReportPrivacyClass);

/** Lifecycle of a generation job — always ends in a terminal state. */
export enum ReportStatus {
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Expired = 'expired',
}

export const REPORT_STATUS_VALUES: readonly ReportStatus[] =
  Object.values(ReportStatus);
