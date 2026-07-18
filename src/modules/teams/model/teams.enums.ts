/**
 * Enumerations for the teams bounded context. Every enum ships a `*_VALUES`
 * array so DTO validation and pure guards can reference the canonical set without
 * re-listing literals. Values are the stable strings persisted in the database.
 */

/** Soft-archive lifecycle shared by teams, venues, and catalog entries. */
export enum ResourceStatus {
  Active = 'active',
  Archived = 'archived',
}

export const RESOURCE_STATUS_VALUES: readonly ResourceStatus[] =
  Object.values(ResourceStatus);

/** Season lifecycle. Only non-archived seasons participate in overlap checks. */
export enum SeasonStatus {
  Draft = 'draft',
  Active = 'active',
  Archived = 'archived',
}

export const SEASON_STATUS_VALUES: readonly SeasonStatus[] =
  Object.values(SeasonStatus);

/**
 * The configurable reference catalogs a team owns. New catalogs are added here;
 * entries within a catalog are managed at runtime and archived, never deleted.
 */
export enum CatalogName {
  Division = 'division',
  GenderFormat = 'gender_format',
  Position = 'position',
}

export const CATALOG_NAME_VALUES: readonly CatalogName[] =
  Object.values(CatalogName);

/**
 * Versioned, effective-dated team settings. Each key names an independent
 * setting whose value is a JSON document resolved into the effective snapshot
 * used by downstream calculations.
 */
export enum SettingKey {
  AttendanceStatuses = 'attendance_statuses',
  SessionTypes = 'session_types',
  AttendanceWeights = 'attendance_weights',
  AssessmentScale = 'assessment_scale',
  BadgeTiers = 'badge_tiers',
  RosterLimits = 'roster_limits',
  NotificationRules = 'notification_rules',
  ReportBranding = 'report_branding',
}

export const SETTING_KEY_VALUES: readonly SettingKey[] =
  Object.values(SettingKey);
