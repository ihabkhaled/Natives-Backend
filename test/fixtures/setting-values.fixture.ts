/**
 * Canonical, policy-valid documents for every `SettingKey` (P2). Shared by the
 * domain policy unit table and the settings e2e suite so both always exercise
 * the same shapes; the frontend mirrors these documents in its schema tests.
 */

/** The audit's exact nonsense payload that returned 201 pre-P2 (regression pin). */
export const AUDIT_NONSENSE_PAYLOAD: Readonly<Record<string, unknown>> = {
  totally: 'unrelated',
  nonsense: 123,
};

export const VALID_ATTENDANCE_STATUSES: Readonly<Record<string, unknown>> = {
  statuses: [
    {
      code: 'present_on_time',
      labelEn: 'On time',
      labelAr: 'في الموعد',
      color: 'success',
      countsTowardMetrics: true,
      allowSelfCheckIn: true,
      active: true,
    },
    {
      code: 'present_late',
      labelEn: 'Late',
      labelAr: 'متأخر',
      color: 'warning',
      countsTowardMetrics: true,
      allowSelfCheckIn: true,
      active: true,
    },
    {
      code: 'excused',
      labelEn: 'Excused',
      labelAr: 'معذور',
      color: 'neutral',
      countsTowardMetrics: false,
      allowSelfCheckIn: false,
      active: true,
    },
    {
      code: 'absent',
      labelEn: 'Absent',
      labelAr: 'غائب',
      color: 'danger',
      countsTowardMetrics: true,
      allowSelfCheckIn: false,
      active: true,
    },
  ],
};

export const VALID_SESSION_TYPES: Readonly<Record<string, unknown>> = {
  types: [
    {
      code: 'practice',
      labelEn: 'Practice',
      labelAr: 'تدريب',
      color: 'primary',
      defaultDurationMinutes: 120,
      active: true,
    },
    {
      code: 'scrimmage',
      labelEn: 'Scrimmage',
      labelAr: 'مباراة ودية',
      color: 'accent1',
      active: true,
    },
  ],
};

export const VALID_ATTENDANCE_WEIGHTS: Readonly<Record<string, unknown>> = {
  weights: {
    present_on_time: 1,
    present_late: 0.5,
    absent: 0,
  },
};

export const VALID_ASSESSMENT_SCALE: Readonly<Record<string, unknown>> = {
  min: 1,
  max: 5,
  step: 1,
  bands: [
    {
      key: 'developing',
      labelEn: 'Developing',
      labelAr: 'قيد التطور',
      from: 1,
      to: 2,
    },
    { key: 'solid', labelEn: 'Solid', labelAr: 'ثابت', from: 3, to: 4 },
    { key: 'elite', labelEn: 'Elite', labelAr: 'نخبة', from: 5, to: 5 },
  ],
};

export const VALID_BADGE_TIERS: Readonly<Record<string, unknown>> = {
  tiers: [
    {
      key: 'bronze',
      labelEn: 'Bronze',
      labelAr: 'برونزي',
      threshold: 100,
      color: 'accent2',
    },
    {
      key: 'silver',
      labelEn: 'Silver',
      labelAr: 'فضي',
      threshold: 250,
      color: 'neutral',
    },
    {
      key: 'gold',
      labelEn: 'Gold',
      labelAr: 'ذهبي',
      threshold: 500,
      color: 'warning',
    },
  ],
};

export const VALID_ROSTER_LIMITS: Readonly<Record<string, unknown>> = {
  roster: { min: 10, max: 27 },
  matchSquad: { min: 7, max: 15 },
  perPosition: [
    { positionKey: 'handler', max: 8 },
    { positionKey: 'cutter', max: 12 },
  ],
};

export const VALID_NOTIFICATION_RULES: Readonly<Record<string, unknown>> = {
  rules: [
    {
      event: 'practice_reminder',
      enabled: true,
      channels: ['push'],
      leadHours: 24,
      recipients: 'members',
    },
    {
      event: 'attendance_finalized',
      enabled: false,
      channels: [],
      recipients: 'staff',
    },
  ],
  quietHours: { start: '22:00', end: '07:00' },
};

export const VALID_REPORT_BRANDING: Readonly<Record<string, unknown>> = {
  displayName: 'Ultimate Natives',
  logoMediaKey: 'teams/natives/logo.png',
  accentColor: '#1B7F4D',
  footerText: 'Powered by Ultimate Natives',
  contactEmail: 'team@natives.example',
};

/** Every canonical valid document, keyed by the `SettingKey` string value. */
export const VALID_SETTING_DOCUMENTS: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  attendance_statuses: VALID_ATTENDANCE_STATUSES,
  session_types: VALID_SESSION_TYPES,
  attendance_weights: VALID_ATTENDANCE_WEIGHTS,
  assessment_scale: VALID_ASSESSMENT_SCALE,
  badge_tiers: VALID_BADGE_TIERS,
  roster_limits: VALID_ROSTER_LIMITS,
  notification_rules: VALID_NOTIFICATION_RULES,
  report_branding: VALID_REPORT_BRANDING,
};
