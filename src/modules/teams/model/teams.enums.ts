/**
 * Enumerations for the teams bounded context. Every enum ships a `*_VALUES`
 * array so DTO validation and pure guards can reference the canonical set without
 * re-listing literals. Values are the stable strings persisted in the database.
 */

/** Soft-archive lifecycle shared by venues and catalog entries. */
export enum ResourceStatus {
  Active = 'active',
  Archived = 'archived',
}

export const RESOURCE_STATUS_VALUES: readonly ResourceStatus[] =
  Object.values(ResourceStatus);

/**
 * Team lifecycle. `Disabled` is the reversible "switched off" state (the team
 * stays visible and its history intact, but it takes no new work); `Archived` is
 * the end-of-life state a team must reach before it can be soft-removed. A team
 * is NEVER hard-deleted — removal only stamps `deleted_at`.
 */
export enum TeamStatus {
  Active = 'active',
  Disabled = 'disabled',
  Archived = 'archived',
}

export const TEAM_STATUS_VALUES: readonly TeamStatus[] =
  Object.values(TeamStatus);

/**
 * Season lifecycle. Only non-archived seasons participate in overlap checks, and
 * at most one season per team may be `Active` at a time (enforced by the partial
 * unique index `ux_seasons_one_active_per_team`), which is what makes "the
 * current season" a deterministic, resolvable value.
 */
export enum SeasonStatus {
  Draft = 'draft',
  Active = 'active',
  Closed = 'closed',
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
