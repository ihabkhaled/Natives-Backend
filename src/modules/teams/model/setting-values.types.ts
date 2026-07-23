import type { ValidationIssue } from '@core/validation';

import type { AttendanceStatus } from '../../practices/model/attendance.enums';
import type {
  ColorToken,
  NotificationChannel,
  NotificationEvent,
  NotificationRecipients,
  SettingValueState,
} from './setting-values.enums';
import type { SettingKey } from './teams.enums';

/**
 * Typed value contracts for the 8 versioned team-setting keys (P2). These are
 * the domain shapes the pure policy (`domain/setting-value.policy.ts`) parses
 * raw jsonb documents into; the OpenAPI value DTOs mirror them 1:1. All lists
 * are ordered arrays (array order = display order).
 */

// --- attendance_statuses ------------------------------------------------------

export interface AttendanceStatusEntry {
  /** One of the canonical 7 `AttendanceStatus` codes (D2). */
  readonly code: AttendanceStatus;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly color: ColorToken;
  /** Participates in attendance math. */
  readonly countsTowardMetrics: boolean;
  /** Member self check-in permitted. */
  readonly allowSelfCheckIn: boolean;
  /** Archived-not-deleted flag. */
  readonly active: boolean;
}

export interface AttendanceStatusesValue {
  readonly statuses: readonly AttendanceStatusEntry[];
}

// --- session_types ------------------------------------------------------------

export interface SessionTypeEntry {
  readonly code: string;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly color: ColorToken;
  readonly defaultDurationMinutes?: number;
  readonly active: boolean;
}

export interface SessionTypesValue {
  readonly types: readonly SessionTypeEntry[];
}

// --- attendance_weights -------------------------------------------------------

export interface AttendanceWeightsValue {
  /** Status code → weight in [0, 1], at most 3 decimal places. */
  readonly weights: Readonly<Record<string, number>>;
}

// --- assessment_scale ---------------------------------------------------------

export interface ScaleBand {
  readonly key: string;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly from: number;
  readonly to: number;
}

export interface AssessmentScaleValue {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly bands?: readonly ScaleBand[];
}

// --- badge_tiers --------------------------------------------------------------

export interface BadgeTier {
  readonly key: string;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly threshold: number;
  readonly color: ColorToken;
}

export interface BadgeTiersValue {
  readonly tiers: readonly BadgeTier[];
}

// --- roster_limits ------------------------------------------------------------

export interface RosterBound {
  readonly min?: number;
  readonly max: number;
}

export interface PositionLimit {
  /** Key of an active `position` reference-catalog entry (cross-checked). */
  readonly positionKey: string;
  readonly max: number;
}

export interface RosterLimitsValue {
  readonly roster: RosterBound;
  readonly matchSquad?: RosterBound;
  readonly perPosition?: readonly PositionLimit[];
}

// --- notification_rules -------------------------------------------------------

export interface NotificationRule {
  readonly event: NotificationEvent;
  readonly enabled: boolean;
  readonly channels: readonly NotificationChannel[];
  /** Hours before the event; 1–168, only for `practice_reminder`. */
  readonly leadHours?: number;
  readonly recipients: NotificationRecipients;
}

export interface QuietHoursWindow {
  /** "HH:mm" Cairo wall time; an overnight window (start > end) is valid. */
  readonly start: string;
  readonly end: string;
}

export interface NotificationRulesValue {
  readonly rules: readonly NotificationRule[];
  readonly quietHours?: QuietHoursWindow;
}

// --- report_branding ----------------------------------------------------------

export interface ReportBrandingValue {
  readonly displayName: string;
  readonly logoMediaKey?: string;
  readonly accentColor?: string;
  readonly footerText?: string;
  readonly contactEmail?: string;
}

// --- Union & policy results ---------------------------------------------------

export interface SettingValueByKey {
  readonly attendance_statuses: AttendanceStatusesValue;
  readonly session_types: SessionTypesValue;
  readonly attendance_weights: AttendanceWeightsValue;
  readonly assessment_scale: AssessmentScaleValue;
  readonly badge_tiers: BadgeTiersValue;
  readonly roster_limits: RosterLimitsValue;
  readonly notification_rules: NotificationRulesValue;
  readonly report_branding: ReportBrandingValue;
}

export type TypedSettingValue = SettingValueByKey[SettingKey];

/** Successful parse: the normalized typed value the policy accepted. */
export interface SettingValueAccepted<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

/** Failed parse: the field/constraint issues that reject the document. */
export interface SettingValueRejected {
  readonly ok: false;
  readonly issues: readonly ValidationIssue[];
}

export type SettingValueResultFor<TValue> =
  SettingValueAccepted<TValue> | SettingValueRejected;

export type SettingValueResult = SettingValueResultFor<TypedSettingValue>;

/** One per-key validator in the policy registry. */
export type SettingValueValidator = (value: unknown) => SettingValueResult;

/**
 * A stored version classified on read (D4): `value` is the parsed typed value
 * for `valid` rows and null for `legacy` rows (never served as effective).
 */
export interface ClassifiedEffectiveVersion {
  readonly settingKey: SettingKey;
  readonly effectiveFrom: Date;
  readonly valueState: SettingValueState;
  readonly value: TypedSettingValue | null;
}
