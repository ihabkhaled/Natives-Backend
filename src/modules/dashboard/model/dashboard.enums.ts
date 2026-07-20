/**
 * Enumerations for the dashboard summary projection. Every enum ships a
 * `*_VALUES` array so DTO/OpenAPI declarations reference the canonical set
 * without re-listing literals. Values are the stable strings on the wire.
 */

/** The headline the client renders, derived from the caller's real grants. */
export enum DashboardPersona {
  Member = 'member',
  Coach = 'coach',
  Administrator = 'administrator',
}

export const DASHBOARD_PERSONA_VALUES: readonly DashboardPersona[] =
  Object.values(DashboardPersona);

/** How a widget's payload is shaped; the client discriminates on this. */
export enum DashboardPresentation {
  Metric = 'metric',
  Breakdown = 'breakdown',
  Tasks = 'tasks',
}

export const DASHBOARD_PRESENTATION_VALUES: readonly DashboardPresentation[] =
  Object.values(DashboardPresentation);

/**
 * Whether a widget carries a usable answer. `empty` means the projection ran and
 * found nothing; `unavailable` means it could not be evaluated for this caller.
 * Neither is ever reported as a zero measurement.
 */
export enum DashboardWidgetStatus {
  Ready = 'ready',
  Empty = 'empty',
  Partial = 'partial',
  Unavailable = 'unavailable',
}

export const DASHBOARD_WIDGET_STATUS_VALUES: readonly DashboardWidgetStatus[] =
  Object.values(DashboardWidgetStatus);

/** The urgency colour a value earns. Derived, never stored. */
export enum DashboardTone {
  Positive = 'positive',
  Neutral = 'neutral',
  Attention = 'attention',
  Critical = 'critical',
}

export const DASHBOARD_TONE_VALUES: readonly DashboardTone[] =
  Object.values(DashboardTone);

/** The unit a metric is expressed in, so the client formats without guessing. */
export enum DashboardMetricUnit {
  Percent = 'percent',
  Points = 'points',
  Rank = 'rank',
}

export const DASHBOARD_METRIC_UNIT_VALUES: readonly DashboardMetricUnit[] =
  Object.values(DashboardMetricUnit);

/**
 * Stable widget identifiers. The client keys its typed registry on these, drops
 * kinds it does not know, and never renders a widget it was not sent.
 */
export enum DashboardWidgetKind {
  MemberSchedule = 'member-schedule',
  MemberAttendance = 'member-attendance',
  MemberStanding = 'member-standing',
  MemberActivity = 'member-activity',
  MemberFeedback = 'member-feedback',
  MemberProfile = 'member-profile',
  CoachSessions = 'coach-sessions',
  CoachAttention = 'coach-attention',
  CoachAssessments = 'coach-assessments',
  CoachRoster = 'coach-roster',
  AdminLifecycle = 'admin-lifecycle',
}

export const DASHBOARD_WIDGET_KIND_VALUES: readonly DashboardWidgetKind[] =
  Object.values(DashboardWidgetKind);
