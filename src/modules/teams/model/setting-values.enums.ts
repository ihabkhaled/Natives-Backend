/**
 * Enumerations for typed team-setting values (P2). Every enum ships a `*_VALUES`
 * array so the domain policy and DTOs can reference the canonical set without
 * re-listing literals. Values are the stable strings persisted inside the
 * `team_setting_versions.value` jsonb documents.
 */

/**
 * Closed list of design color tokens a setting value may reference. Raw hex is
 * never accepted here — the only hex field in settings is report branding's
 * accent color, validated by its own pattern.
 */
export enum ColorToken {
  Primary = 'primary',
  Success = 'success',
  Warning = 'warning',
  Danger = 'danger',
  Neutral = 'neutral',
  Accent1 = 'accent1',
  Accent2 = 'accent2',
  Accent3 = 'accent3',
  Accent4 = 'accent4',
}

export const COLOR_TOKEN_VALUES: readonly ColorToken[] =
  Object.values(ColorToken);

/** Closed v1 catalog of notification-rule events. */
export enum NotificationEvent {
  PracticeReminder = 'practice_reminder',
  PracticeChange = 'practice_change',
  AttendanceFinalized = 'attendance_finalized',
  BadgeAwarded = 'badge_awarded',
}

export const NOTIFICATION_EVENT_VALUES: readonly NotificationEvent[] =
  Object.values(NotificationEvent);

/** Delivery channels a notification rule may enable. */
export enum NotificationChannel {
  Push = 'push',
  Email = 'email',
}

export const NOTIFICATION_CHANNEL_VALUES: readonly NotificationChannel[] =
  Object.values(NotificationChannel);

/** Audience selector of one notification rule. */
export enum NotificationRecipients {
  Members = 'members',
  Staff = 'staff',
  All = 'all',
}

export const NOTIFICATION_RECIPIENTS_VALUES: readonly NotificationRecipients[] =
  Object.values(NotificationRecipients);

/**
 * Read-time classification of a stored setting value (D4). `Valid` documents
 * satisfy the current per-key contract; `Legacy` rows predate validation and are
 * never served as an effective value (the snapshot resolves them to null).
 */
export enum SettingValueState {
  Valid = 'valid',
  Legacy = 'legacy',
}

export const SETTING_VALUE_STATE_VALUES: readonly SettingValueState[] =
  Object.values(SettingValueState);
