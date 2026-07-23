import type { ValidationIssue } from '@core/validation';

import { ATTENDANCE_STATUS_VALUES } from '../../practices/model/attendance.enums';
import {
  ASSESSMENT_BANDS_MAX,
  ASSESSMENT_SCALE_CEILING,
  ASSESSMENT_SCALE_FLOOR,
  ASSESSMENT_SCALE_STEP_MIN,
  ATTENDANCE_STATUS_ENTRIES_MAX,
  ATTENDANCE_STATUS_ENTRIES_MIN,
  ATTENDANCE_WEIGHT_EPSILON,
  ATTENDANCE_WEIGHT_MAX,
  ATTENDANCE_WEIGHT_MIN,
  ATTENDANCE_WEIGHT_SCALE,
  BADGE_THRESHOLD_MAX,
  BADGE_THRESHOLD_MIN,
  BADGE_TIERS_MAX,
  BADGE_TIERS_MIN,
  BRANDING_ACCENT_PATTERN,
  BRANDING_DISPLAY_NAME_MAX_LENGTH,
  BRANDING_EMAIL_MAX_LENGTH,
  BRANDING_EMAIL_PATTERN,
  BRANDING_FOOTER_MAX_LENGTH,
  BRANDING_LOGO_KEY_MAX_LENGTH,
  CONSTRAINT_SUBJECT_SEPARATOR,
  LEAD_HOURS_MAX,
  LEAD_HOURS_MIN,
  MATCH_SQUAD_MIN_FLOOR,
  QUIET_HOURS_TIME_PATTERN,
  REQUIRED_STATUS_POLES,
  ROSTER_SIZE_MAX,
  SESSION_DURATION_MAX_MINUTES,
  SESSION_DURATION_MIN_MINUTES,
  SESSION_TYPES_MAX,
  SESSION_TYPES_MIN,
  SETTING_CODE_PATTERN,
  SETTING_LABEL_MAX_LENGTH,
  SETTING_LABEL_MIN_LENGTH,
  SETTING_VALUE_CONSTRAINTS,
} from '../model/setting-values.constants';
import {
  COLOR_TOKEN_VALUES,
  NOTIFICATION_CHANNEL_VALUES,
  NOTIFICATION_EVENT_VALUES,
  NOTIFICATION_RECIPIENTS_VALUES,
  type NotificationChannel,
  NotificationEvent,
  SettingValueState,
} from '../model/setting-values.enums';
import type {
  AssessmentScaleValue,
  AttendanceStatusEntry,
  AttendanceStatusesValue,
  AttendanceWeightsValue,
  BadgeTier,
  BadgeTiersValue,
  ClassifiedEffectiveVersion,
  NotificationRule,
  NotificationRulesValue,
  PositionLimit,
  QuietHoursWindow,
  ReportBrandingValue,
  RosterBound,
  RosterLimitsValue,
  ScaleBand,
  SessionTypeEntry,
  SessionTypesValue,
  SettingValueRejected,
  SettingValueResult,
  SettingValueResultFor,
  SettingValueValidator,
  TypedSettingValue,
} from '../model/setting-values.types';
import { SettingKey } from '../model/teams.enums';
import type {
  ClassifiedSettingVersion,
  SettingVersion,
} from '../model/teams.types';

/**
 * Pure per-key validation of team-setting values (P2, decision D1). Every write
 * runs the raw jsonb document through `validateSettingValue`; the same function
 * classifies stored rows on read (`valid` vs `legacy`, D4). Unknown extra
 * properties are rejected — this is exactly the audit's nonsense-payload hole
 * (`{"totally":"unrelated","nonsense":123}` returned 201 before P2).
 */

type JsonRecord = Readonly<Record<string, unknown>>;

const CONSTRAINTS = SETTING_VALUE_CONSTRAINTS;
const VALUE_PATH = 'value';

// --- Shared field helpers -----------------------------------------------------

function issueAt(field: string, constraint: string): ValidationIssue {
  return { field, constraint };
}

function subjectIssue(
  field: string,
  code: string,
  subject: string,
): ValidationIssue {
  return issueAt(field, `${code}${CONSTRAINT_SUBJECT_SEPARATOR}${subject}`);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Read one member of an untrusted JSON record without a computed member access
 * (object-injection safe): the record is copied into a Map first.
 */
function readMember(target: JsonRecord, field: string): unknown {
  return new Map(Object.entries(target)).get(field);
}

function fieldPath(path: string, field: string): string {
  return `${path}.${field}`;
}

function unexpectedKeyIssues(
  target: JsonRecord,
  allowed: readonly string[],
  path: string,
): readonly ValidationIssue[] {
  return Object.keys(target)
    .filter(key => !allowed.includes(key))
    .map(key => issueAt(fieldPath(path, key), CONSTRAINTS.unexpectedProperty));
}

function readRootObject(
  value: unknown,
  allowed: readonly string[],
  issues: ValidationIssue[],
): JsonRecord | null {
  if (!isJsonRecord(value)) {
    issues.push(issueAt(VALUE_PATH, CONSTRAINTS.notAnObject));
    return null;
  }
  issues.push(...unexpectedKeyIssues(value, allowed, VALUE_PATH));
  return value;
}

function pushMissingOrInvalid(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): void {
  const constraint =
    field in target ? CONSTRAINTS.invalidType : CONSTRAINTS.missingProperty;
  issues.push(issueAt(fieldPath(path, field), constraint));
}

function readString(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): string | null {
  const raw = readMember(target, field);
  if (typeof raw === 'string') {
    return raw;
  }
  pushMissingOrInvalid(target, path, field, issues);
  return null;
}

function readBoolean(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): boolean | null {
  const raw = readMember(target, field);
  if (typeof raw === 'boolean') {
    return raw;
  }
  pushMissingOrInvalid(target, path, field, issues);
  return null;
}

function readInt(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): number | null {
  const raw = readMember(target, field);
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw;
  }
  pushMissingOrInvalid(target, path, field, issues);
  return null;
}

function readOptionalInt(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): number | undefined {
  const raw = readMember(target, field);
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw;
  }
  issues.push(issueAt(fieldPath(path, field), CONSTRAINTS.invalidType));
  return undefined;
}

function readOptionalString(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): string | undefined {
  const raw = readMember(target, field);
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw === 'string') {
    return raw;
  }
  issues.push(issueAt(fieldPath(path, field), CONSTRAINTS.invalidType));
  return undefined;
}

function readEnum<TValue extends string>(
  target: JsonRecord,
  path: string,
  field: string,
  values: readonly TValue[],
  constraint: string,
  issues: ValidationIssue[],
): TValue | null {
  const raw = readMember(target, field);
  if (typeof raw !== 'string') {
    pushMissingOrInvalid(target, path, field, issues);
    return null;
  }
  const match = values.find(value => value === raw);
  if (match === undefined) {
    issues.push(issueAt(fieldPath(path, field), constraint));
    return null;
  }
  return match;
}

function readLabel(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): string | null {
  const raw = readString(target, path, field, issues);
  if (raw === null) {
    return null;
  }
  if (
    raw.length < SETTING_LABEL_MIN_LENGTH ||
    raw.length > SETTING_LABEL_MAX_LENGTH
  ) {
    issues.push(issueAt(fieldPath(path, field), CONSTRAINTS.invalidLabel));
    return null;
  }
  return raw;
}

function readCode(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): string | null {
  const raw = readString(target, path, field, issues);
  if (raw === null) {
    return null;
  }
  if (!SETTING_CODE_PATTERN.test(raw)) {
    issues.push(issueAt(fieldPath(path, field), CONSTRAINTS.invalidCode));
    return null;
  }
  return raw;
}

function readArray(
  target: JsonRecord,
  path: string,
  field: string,
  issues: ValidationIssue[],
): readonly unknown[] | null {
  const raw = readMember(target, field);
  if (isUnknownArray(raw)) {
    return raw;
  }
  pushMissingOrInvalid(target, path, field, issues);
  return null;
}

function checkEntryCount(
  count: number,
  min: number,
  max: number,
  path: string,
  issues: ValidationIssue[],
): void {
  if (count < min) {
    issues.push(issueAt(path, CONSTRAINTS.tooFewEntries));
  }
  if (count > max) {
    issues.push(issueAt(path, CONSTRAINTS.tooManyEntries));
  }
}

function pushDuplicateIssues(
  values: readonly string[],
  path: string,
  constraint: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push(subjectIssue(path, constraint, value));
    }
    seen.add(value);
  }
}

function compact<TValue>(entries: readonly (TValue | null)[]): TValue[] {
  const present: TValue[] = [];
  for (const entry of entries) {
    if (entry !== null) {
      present.push(entry);
    }
  }
  return present;
}

function accepted<TValue>(value: TValue): SettingValueResultFor<TValue> {
  return { ok: true, value };
}

function rejected(issues: readonly ValidationIssue[]): SettingValueRejected {
  return { ok: false, issues };
}

// --- attendance_statuses ------------------------------------------------------

const ATTENDANCE_STATUS_ENTRY_KEYS: readonly string[] = [
  'code',
  'labelEn',
  'labelAr',
  'color',
  'countsTowardMetrics',
  'allowSelfCheckIn',
  'active',
];

function parseAttendanceStatusEntry(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): AttendanceStatusEntry | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, ATTENDANCE_STATUS_ENTRY_KEYS, path));
  const code = readEnum(
    raw,
    path,
    'code',
    ATTENDANCE_STATUS_VALUES,
    CONSTRAINTS.invalidCode,
    issues,
  );
  const labelEn = readLabel(raw, path, 'labelEn', issues);
  const labelAr = readLabel(raw, path, 'labelAr', issues);
  const color = readEnum(
    raw,
    path,
    'color',
    COLOR_TOKEN_VALUES,
    CONSTRAINTS.invalidColor,
    issues,
  );
  const countsTowardMetrics = readBoolean(
    raw,
    path,
    'countsTowardMetrics',
    issues,
  );
  const allowSelfCheckIn = readBoolean(raw, path, 'allowSelfCheckIn', issues);
  const active = readBoolean(raw, path, 'active', issues);
  if (
    code === null ||
    labelEn === null ||
    labelAr === null ||
    color === null ||
    countsTowardMetrics === null ||
    allowSelfCheckIn === null ||
    active === null
  ) {
    return null;
  }
  return {
    code,
    labelEn,
    labelAr,
    color,
    countsTowardMetrics,
    allowSelfCheckIn,
    active,
  };
}

function checkAttendanceStatusRules(
  statuses: readonly AttendanceStatusEntry[],
  issues: ValidationIssue[],
): void {
  const path = fieldPath(VALUE_PATH, 'statuses');
  pushDuplicateIssues(
    statuses.map(entry => entry.code),
    path,
    CONSTRAINTS.duplicateCode,
    issues,
  );
  for (const pole of REQUIRED_STATUS_POLES) {
    const entry = statuses.find(candidate => candidate.code === pole);
    if (!entry?.active) {
      issues.push(subjectIssue(path, CONSTRAINTS.missingPole, pole));
    }
  }
  const hasMetricStatus = statuses.some(
    entry => entry.active && entry.countsTowardMetrics,
  );
  if (!hasMetricStatus) {
    issues.push(issueAt(path, CONSTRAINTS.noMetricStatus));
  }
}

export function validateAttendanceStatusesValue(
  value: unknown,
): SettingValueResultFor<AttendanceStatusesValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, ['statuses'], issues);
  const rawList =
    root === null ? null : readArray(root, VALUE_PATH, 'statuses', issues);
  if (rawList === null) {
    return rejected(issues);
  }
  checkEntryCount(
    rawList.length,
    ATTENDANCE_STATUS_ENTRIES_MIN,
    ATTENDANCE_STATUS_ENTRIES_MAX,
    fieldPath(VALUE_PATH, 'statuses'),
    issues,
  );
  const statuses = compact(
    rawList.map((raw, index) =>
      parseAttendanceStatusEntry(
        raw,
        `${fieldPath(VALUE_PATH, 'statuses')}[${index}]`,
        issues,
      ),
    ),
  );
  if (statuses.length === rawList.length) {
    checkAttendanceStatusRules(statuses, issues);
  }
  return issues.length > 0 ? rejected(issues) : accepted({ statuses });
}

// --- session_types ------------------------------------------------------------

const SESSION_TYPE_ENTRY_KEYS: readonly string[] = [
  'code',
  'labelEn',
  'labelAr',
  'color',
  'defaultDurationMinutes',
  'active',
];

function parseSessionTypeEntry(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): SessionTypeEntry | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, SESSION_TYPE_ENTRY_KEYS, path));
  const code = readCode(raw, path, 'code', issues);
  const labelEn = readLabel(raw, path, 'labelEn', issues);
  const labelAr = readLabel(raw, path, 'labelAr', issues);
  const color = readEnum(
    raw,
    path,
    'color',
    COLOR_TOKEN_VALUES,
    CONSTRAINTS.invalidColor,
    issues,
  );
  const duration = readSessionDuration(raw, path, issues);
  const active = readBoolean(raw, path, 'active', issues);
  if (code === null || labelEn === null || labelAr === null) {
    return null;
  }
  if (color === null || active === null) {
    return null;
  }
  return {
    code,
    labelEn,
    labelAr,
    color,
    active,
    ...(duration === undefined ? {} : { defaultDurationMinutes: duration }),
  };
}

function readSessionDuration(
  raw: JsonRecord,
  path: string,
  issues: ValidationIssue[],
): number | undefined {
  const duration = readOptionalInt(raw, path, 'defaultDurationMinutes', issues);
  if (duration === undefined) {
    return undefined;
  }
  if (
    duration < SESSION_DURATION_MIN_MINUTES ||
    duration > SESSION_DURATION_MAX_MINUTES
  ) {
    issues.push(
      issueAt(
        fieldPath(path, 'defaultDurationMinutes'),
        CONSTRAINTS.outOfRange,
      ),
    );
    return undefined;
  }
  return duration;
}

export function validateSessionTypesValue(
  value: unknown,
): SettingValueResultFor<SessionTypesValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, ['types'], issues);
  const rawList =
    root === null ? null : readArray(root, VALUE_PATH, 'types', issues);
  if (rawList === null) {
    return rejected(issues);
  }
  const path = fieldPath(VALUE_PATH, 'types');
  checkEntryCount(
    rawList.length,
    SESSION_TYPES_MIN,
    SESSION_TYPES_MAX,
    path,
    issues,
  );
  const types = compact(
    rawList.map((raw, index) =>
      parseSessionTypeEntry(raw, `${path}[${index}]`, issues),
    ),
  );
  if (types.length === rawList.length) {
    pushDuplicateIssues(
      types.map(entry => entry.code),
      path,
      CONSTRAINTS.duplicateCode,
      issues,
    );
    if (!types.some(entry => entry.active)) {
      issues.push(issueAt(path, CONSTRAINTS.noActiveEntry));
    }
  }
  return issues.length > 0 ? rejected(issues) : accepted({ types });
}

// --- attendance_weights -------------------------------------------------------

function checkWeightEntry(
  code: string,
  weight: unknown,
  issues: ValidationIssue[],
): number | null {
  const path = fieldPath(VALUE_PATH, 'weights');
  if (!SETTING_CODE_PATTERN.test(code)) {
    issues.push(subjectIssue(path, CONSTRAINTS.invalidCode, code));
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight)) {
    issues.push(issueAt(fieldPath(path, code), CONSTRAINTS.invalidType));
    return null;
  }
  if (weight < ATTENDANCE_WEIGHT_MIN || weight > ATTENDANCE_WEIGHT_MAX) {
    issues.push(issueAt(fieldPath(path, code), CONSTRAINTS.outOfRange));
    return null;
  }
  const scaled = weight * ATTENDANCE_WEIGHT_SCALE;
  if (Math.abs(scaled - Math.round(scaled)) > ATTENDANCE_WEIGHT_EPSILON) {
    issues.push(issueAt(fieldPath(path, code), CONSTRAINTS.tooManyDecimals));
    return null;
  }
  return weight;
}

export function validateAttendanceWeightsValue(
  value: unknown,
): SettingValueResultFor<AttendanceWeightsValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, ['weights'], issues);
  const rawWeights = root?.['weights'];
  if (root !== null && !isJsonRecord(rawWeights)) {
    pushMissingOrInvalid(root, VALUE_PATH, 'weights', issues);
  }
  if (!isJsonRecord(rawWeights)) {
    return rejected(issues);
  }
  const entries: [string, number][] = [];
  for (const [code, weight] of Object.entries(rawWeights)) {
    const parsed = checkWeightEntry(code, weight, issues);
    if (parsed !== null) {
      entries.push([code, parsed]);
    }
  }
  if (issues.length > 0) {
    return rejected(issues);
  }
  return accepted({ weights: Object.fromEntries(entries) });
}

// --- assessment_scale ---------------------------------------------------------

const SCALE_BAND_KEYS: readonly string[] = [
  'key',
  'labelEn',
  'labelAr',
  'from',
  'to',
];

function parseScaleBand(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): ScaleBand | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, SCALE_BAND_KEYS, path));
  const key = readCode(raw, path, 'key', issues);
  const labelEn = readLabel(raw, path, 'labelEn', issues);
  const labelAr = readLabel(raw, path, 'labelAr', issues);
  const from = readInt(raw, path, 'from', issues);
  const to = readInt(raw, path, 'to', issues);
  if (key === null || labelEn === null || labelAr === null) {
    return null;
  }
  if (from === null || to === null) {
    return null;
  }
  return { key, labelEn, labelAr, from, to };
}

function checkScaleBounds(
  min: number,
  max: number,
  step: number,
  issues: ValidationIssue[],
): void {
  if (min < ASSESSMENT_SCALE_FLOOR || max > ASSESSMENT_SCALE_CEILING) {
    issues.push(issueAt(VALUE_PATH, CONSTRAINTS.outOfRange));
  }
  if (min >= max) {
    issues.push(issueAt(VALUE_PATH, CONSTRAINTS.minNotBelowMax));
    return;
  }
  if (step < ASSESSMENT_SCALE_STEP_MIN) {
    issues.push(issueAt(fieldPath(VALUE_PATH, 'step'), CONSTRAINTS.outOfRange));
    return;
  }
  if ((max - min) % step !== 0) {
    issues.push(
      issueAt(fieldPath(VALUE_PATH, 'step'), CONSTRAINTS.stepNotDivisor),
    );
  }
}

function checkBandRules(
  bands: readonly ScaleBand[],
  min: number,
  max: number,
  issues: ValidationIssue[],
): void {
  const path = fieldPath(VALUE_PATH, 'bands');
  pushDuplicateIssues(
    bands.map(band => band.key),
    path,
    CONSTRAINTS.duplicateCode,
    issues,
  );
  let previousTo: number | null = null;
  for (const [index, band] of bands.entries()) {
    if (band.from > band.to || band.from < min || band.to > max) {
      issues.push(issueAt(`${path}[${index}]`, CONSTRAINTS.bandOutsideScale));
    }
    if (previousTo !== null && band.from <= previousTo) {
      issues.push(issueAt(`${path}[${index}]`, CONSTRAINTS.bandOverlap));
    }
    previousTo = band.to;
  }
}

function parseScaleBands(
  root: JsonRecord,
  issues: ValidationIssue[],
): readonly ScaleBand[] | undefined {
  if (root['bands'] === undefined) {
    return undefined;
  }
  const rawBands = readArray(root, VALUE_PATH, 'bands', issues);
  if (rawBands === null) {
    return undefined;
  }
  const path = fieldPath(VALUE_PATH, 'bands');
  if (rawBands.length > ASSESSMENT_BANDS_MAX) {
    issues.push(issueAt(path, CONSTRAINTS.tooManyEntries));
  }
  const bands = compact(
    rawBands.map((raw, index) =>
      parseScaleBand(raw, `${path}[${index}]`, issues),
    ),
  );
  return bands.length === rawBands.length ? bands : undefined;
}

export function validateAssessmentScaleValue(
  value: unknown,
): SettingValueResultFor<AssessmentScaleValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, ['min', 'max', 'step', 'bands'], issues);
  if (root === null) {
    return rejected(issues);
  }
  const min = readInt(root, VALUE_PATH, 'min', issues);
  const max = readInt(root, VALUE_PATH, 'max', issues);
  const step = readInt(root, VALUE_PATH, 'step', issues);
  const bands = parseScaleBands(root, issues);
  if (min !== null && max !== null && step !== null) {
    checkScaleBounds(min, max, step, issues);
    if (bands !== undefined) {
      checkBandRules(bands, min, max, issues);
    }
  }
  if (issues.length > 0 || min === null || max === null || step === null) {
    return rejected(issues);
  }
  return accepted({
    min,
    max,
    step,
    ...(bands === undefined ? {} : { bands }),
  });
}

// --- badge_tiers --------------------------------------------------------------

const BADGE_TIER_KEYS: readonly string[] = [
  'key',
  'labelEn',
  'labelAr',
  'threshold',
  'color',
];

function parseBadgeTier(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): BadgeTier | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, BADGE_TIER_KEYS, path));
  const key = readCode(raw, path, 'key', issues);
  const labelEn = readLabel(raw, path, 'labelEn', issues);
  const labelAr = readLabel(raw, path, 'labelAr', issues);
  const threshold = readInt(raw, path, 'threshold', issues);
  const color = readEnum(
    raw,
    path,
    'color',
    COLOR_TOKEN_VALUES,
    CONSTRAINTS.invalidColor,
    issues,
  );
  if (key === null || labelEn === null || labelAr === null) {
    return null;
  }
  if (threshold === null || color === null) {
    return null;
  }
  if (threshold < BADGE_THRESHOLD_MIN || threshold > BADGE_THRESHOLD_MAX) {
    issues.push(issueAt(fieldPath(path, 'threshold'), CONSTRAINTS.outOfRange));
    return null;
  }
  return { key, labelEn, labelAr, threshold, color };
}

function checkTierRules(
  tiers: readonly BadgeTier[],
  issues: ValidationIssue[],
): void {
  const path = fieldPath(VALUE_PATH, 'tiers');
  pushDuplicateIssues(
    tiers.map(tier => tier.key),
    path,
    CONSTRAINTS.duplicateCode,
    issues,
  );
  let previous: number | null = null;
  for (const [index, tier] of tiers.entries()) {
    if (previous !== null && tier.threshold <= previous) {
      issues.push(
        issueAt(`${path}[${index}]`, CONSTRAINTS.thresholdNotAscending),
      );
    }
    previous = tier.threshold;
  }
}

export function validateBadgeTiersValue(
  value: unknown,
): SettingValueResultFor<BadgeTiersValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, ['tiers'], issues);
  const rawList =
    root === null ? null : readArray(root, VALUE_PATH, 'tiers', issues);
  if (rawList === null) {
    return rejected(issues);
  }
  const path = fieldPath(VALUE_PATH, 'tiers');
  checkEntryCount(
    rawList.length,
    BADGE_TIERS_MIN,
    BADGE_TIERS_MAX,
    path,
    issues,
  );
  const tiers = compact(
    rawList.map((raw, index) =>
      parseBadgeTier(raw, `${path}[${index}]`, issues),
    ),
  );
  if (tiers.length === rawList.length) {
    checkTierRules(tiers, issues);
  }
  return issues.length > 0 ? rejected(issues) : accepted({ tiers });
}

// --- roster_limits ------------------------------------------------------------

const ROSTER_BOUND_KEYS: readonly string[] = ['min', 'max'];
const POSITION_LIMIT_KEYS: readonly string[] = ['positionKey', 'max'];

function parseRosterBound(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): RosterBound | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, ROSTER_BOUND_KEYS, path));
  const min = readOptionalInt(raw, path, 'min', issues);
  const max = readInt(raw, path, 'max', issues);
  if (max === null) {
    return null;
  }
  if (max < 1 || (min !== undefined && min < 1)) {
    issues.push(issueAt(path, CONSTRAINTS.outOfRange));
    return null;
  }
  if (min !== undefined && min > max) {
    issues.push(issueAt(path, CONSTRAINTS.minNotBelowMax));
    return null;
  }
  return { max, ...(min === undefined ? {} : { min }) };
}

function parsePositionLimit(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): PositionLimit | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, POSITION_LIMIT_KEYS, path));
  const positionKey = readCode(raw, path, 'positionKey', issues);
  const max = readInt(raw, path, 'max', issues);
  if (positionKey === null || max === null) {
    return null;
  }
  if (max < 1) {
    issues.push(issueAt(fieldPath(path, 'max'), CONSTRAINTS.outOfRange));
    return null;
  }
  return { positionKey, max };
}

function parsePositionLimits(
  root: JsonRecord,
  issues: ValidationIssue[],
): readonly PositionLimit[] | undefined {
  if (root['perPosition'] === undefined) {
    return undefined;
  }
  const rawList = readArray(root, VALUE_PATH, 'perPosition', issues);
  if (rawList === null) {
    return undefined;
  }
  const path = fieldPath(VALUE_PATH, 'perPosition');
  const limits = compact(
    rawList.map((raw, index) =>
      parsePositionLimit(raw, `${path}[${index}]`, issues),
    ),
  );
  if (limits.length !== rawList.length) {
    return undefined;
  }
  pushDuplicateIssues(
    limits.map(limit => limit.positionKey),
    path,
    CONSTRAINTS.duplicateCode,
    issues,
  );
  return limits;
}

function checkRosterRules(
  roster: RosterBound,
  matchSquad: RosterBound | undefined,
  perPosition: readonly PositionLimit[] | undefined,
  issues: ValidationIssue[],
): void {
  if (roster.max > ROSTER_SIZE_MAX) {
    issues.push(
      issueAt(fieldPath(VALUE_PATH, 'roster'), CONSTRAINTS.outOfRange),
    );
  }
  if (matchSquad === undefined) {
    return;
  }
  const squadPath = fieldPath(VALUE_PATH, 'matchSquad');
  if (matchSquad.max > roster.max) {
    issues.push(issueAt(squadPath, CONSTRAINTS.squadExceedsRoster));
  }
  if (matchSquad.max < MATCH_SQUAD_MIN_FLOOR) {
    issues.push(issueAt(squadPath, CONSTRAINTS.squadBelowLine));
  }
  if (perPosition !== undefined && matchSquad.min !== undefined) {
    const capacity = perPosition.reduce((sum, limit) => sum + limit.max, 0);
    if (capacity < matchSquad.min) {
      issues.push(
        issueAt(
          fieldPath(VALUE_PATH, 'perPosition'),
          CONSTRAINTS.positionCapBelowSquadMin,
        ),
      );
    }
  }
}

export function validateRosterLimitsValue(
  value: unknown,
): SettingValueResultFor<RosterLimitsValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(
    value,
    ['roster', 'matchSquad', 'perPosition'],
    issues,
  );
  if (root === null) {
    return rejected(issues);
  }
  if (root['roster'] === undefined) {
    pushMissingOrInvalid(root, VALUE_PATH, 'roster', issues);
    return rejected(issues);
  }
  const roster = parseRosterBound(
    root['roster'],
    fieldPath(VALUE_PATH, 'roster'),
    issues,
  );
  const matchSquad =
    root['matchSquad'] === undefined
      ? undefined
      : parseRosterBound(
          root['matchSquad'],
          fieldPath(VALUE_PATH, 'matchSquad'),
          issues,
        );
  const perPosition = parsePositionLimits(root, issues);
  if (roster !== null && matchSquad !== null) {
    checkRosterRules(roster, matchSquad, perPosition, issues);
  }
  if (issues.length > 0 || roster === null || matchSquad === null) {
    return rejected(issues);
  }
  return accepted({
    roster,
    ...(matchSquad === undefined ? {} : { matchSquad }),
    ...(perPosition === undefined ? {} : { perPosition }),
  });
}

// --- notification_rules -------------------------------------------------------

const NOTIFICATION_RULE_KEYS: readonly string[] = [
  'event',
  'enabled',
  'channels',
  'leadHours',
  'recipients',
];
const QUIET_HOURS_KEYS: readonly string[] = ['start', 'end'];

function parseNotificationChannels(
  raw: JsonRecord,
  path: string,
  issues: ValidationIssue[],
): readonly NotificationChannel[] | null {
  const rawChannels = readArray(raw, path, 'channels', issues);
  if (rawChannels === null) {
    return null;
  }
  const channelPath = fieldPath(path, 'channels');
  const channels = compact(
    rawChannels.map(candidate => {
      const match = NOTIFICATION_CHANNEL_VALUES.find(
        channel => channel === candidate,
      );
      if (match === undefined) {
        issues.push(issueAt(channelPath, CONSTRAINTS.invalidType));
        return null;
      }
      return match;
    }),
  );
  if (channels.length !== rawChannels.length) {
    return null;
  }
  pushDuplicateIssues(
    channels,
    channelPath,
    CONSTRAINTS.duplicateChannel,
    issues,
  );
  return channels;
}

function checkLeadHours(
  rule: JsonRecord,
  event: NotificationEvent,
  path: string,
  issues: ValidationIssue[],
): number | undefined {
  const leadHours = readOptionalInt(rule, path, 'leadHours', issues);
  const leadPath = fieldPath(path, 'leadHours');
  if (event === NotificationEvent.PracticeReminder) {
    if (leadHours === undefined) {
      issues.push(issueAt(leadPath, CONSTRAINTS.leadHoursRequired));
      return undefined;
    }
    if (leadHours < LEAD_HOURS_MIN || leadHours > LEAD_HOURS_MAX) {
      issues.push(issueAt(leadPath, CONSTRAINTS.outOfRange));
      return undefined;
    }
    return leadHours;
  }
  if (leadHours !== undefined) {
    issues.push(issueAt(leadPath, CONSTRAINTS.leadHoursForbidden));
  }
  return undefined;
}

function parseNotificationRule(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): NotificationRule | null {
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return null;
  }
  issues.push(...unexpectedKeyIssues(raw, NOTIFICATION_RULE_KEYS, path));
  const event = readEnum(
    raw,
    path,
    'event',
    NOTIFICATION_EVENT_VALUES,
    CONSTRAINTS.unknownEvent,
    issues,
  );
  const enabled = readBoolean(raw, path, 'enabled', issues);
  const channels = parseNotificationChannels(raw, path, issues);
  const recipients = readEnum(
    raw,
    path,
    'recipients',
    NOTIFICATION_RECIPIENTS_VALUES,
    CONSTRAINTS.invalidType,
    issues,
  );
  if (event === null || enabled === null || channels === null) {
    return null;
  }
  if (recipients === null) {
    return null;
  }
  const leadHours = checkLeadHours(raw, event, path, issues);
  if (enabled && channels.length === 0) {
    issues.push(issueAt(fieldPath(path, 'channels'), CONSTRAINTS.noChannel));
  }
  return {
    event,
    enabled,
    channels,
    recipients,
    ...(leadHours === undefined ? {} : { leadHours }),
  };
}

function parseQuietHours(
  root: JsonRecord,
  issues: ValidationIssue[],
): QuietHoursWindow | undefined {
  if (root['quietHours'] === undefined) {
    return undefined;
  }
  const raw = root['quietHours'];
  const path = fieldPath(VALUE_PATH, 'quietHours');
  if (!isJsonRecord(raw)) {
    issues.push(issueAt(path, CONSTRAINTS.invalidType));
    return undefined;
  }
  issues.push(...unexpectedKeyIssues(raw, QUIET_HOURS_KEYS, path));
  const start = readString(raw, path, 'start', issues);
  const end = readString(raw, path, 'end', issues);
  if (start === null || end === null) {
    return undefined;
  }
  if (
    !QUIET_HOURS_TIME_PATTERN.test(start) ||
    !QUIET_HOURS_TIME_PATTERN.test(end)
  ) {
    issues.push(issueAt(path, CONSTRAINTS.invalidTime));
    return undefined;
  }
  if (start === end) {
    issues.push(issueAt(path, CONSTRAINTS.quietHoursEqual));
    return undefined;
  }
  return { start, end };
}

export function validateNotificationRulesValue(
  value: unknown,
): SettingValueResultFor<NotificationRulesValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, ['rules', 'quietHours'], issues);
  const rawRules =
    root === null ? null : readArray(root, VALUE_PATH, 'rules', issues);
  if (root === null || rawRules === null) {
    return rejected(issues);
  }
  const path = fieldPath(VALUE_PATH, 'rules');
  const rules = compact(
    rawRules.map((raw, index) =>
      parseNotificationRule(raw, `${path}[${index}]`, issues),
    ),
  );
  if (rules.length === rawRules.length) {
    pushDuplicateIssues(
      rules.map(rule => rule.event),
      path,
      CONSTRAINTS.duplicateEvent,
      issues,
    );
  }
  const quietHours = parseQuietHours(root, issues);
  if (issues.length > 0) {
    return rejected(issues);
  }
  return accepted({
    rules,
    ...(quietHours === undefined ? {} : { quietHours }),
  });
}

// --- report_branding ----------------------------------------------------------

const REPORT_BRANDING_KEYS: readonly string[] = [
  'displayName',
  'logoMediaKey',
  'accentColor',
  'footerText',
  'contactEmail',
];

function readDisplayName(
  root: JsonRecord,
  issues: ValidationIssue[],
): string | null {
  const raw = readString(root, VALUE_PATH, 'displayName', issues);
  if (raw === null) {
    return null;
  }
  const path = fieldPath(VALUE_PATH, 'displayName');
  if (raw.trim().length === 0) {
    issues.push(issueAt(path, CONSTRAINTS.blankText));
    return null;
  }
  if (raw.length > BRANDING_DISPLAY_NAME_MAX_LENGTH) {
    issues.push(issueAt(path, CONSTRAINTS.outOfRange));
    return null;
  }
  return raw;
}

function readBrandingOptionals(
  root: JsonRecord,
  issues: ValidationIssue[],
): Omit<ReportBrandingValue, 'displayName'> {
  const logoMediaKey = readOptionalString(
    root,
    VALUE_PATH,
    'logoMediaKey',
    issues,
  );
  const accentColor = readOptionalString(
    root,
    VALUE_PATH,
    'accentColor',
    issues,
  );
  const footerText = readOptionalString(root, VALUE_PATH, 'footerText', issues);
  const contactEmail = readOptionalString(
    root,
    VALUE_PATH,
    'contactEmail',
    issues,
  );
  if (
    logoMediaKey !== undefined &&
    (logoMediaKey.length === 0 ||
      logoMediaKey.length > BRANDING_LOGO_KEY_MAX_LENGTH)
  ) {
    issues.push(
      issueAt(fieldPath(VALUE_PATH, 'logoMediaKey'), CONSTRAINTS.outOfRange),
    );
  }
  if (accentColor !== undefined && !BRANDING_ACCENT_PATTERN.test(accentColor)) {
    issues.push(
      issueAt(
        fieldPath(VALUE_PATH, 'accentColor'),
        CONSTRAINTS.invalidAccentColor,
      ),
    );
  }
  if (
    footerText !== undefined &&
    footerText.length > BRANDING_FOOTER_MAX_LENGTH
  ) {
    issues.push(
      issueAt(fieldPath(VALUE_PATH, 'footerText'), CONSTRAINTS.outOfRange),
    );
  }
  if (
    contactEmail !== undefined &&
    (contactEmail.length > BRANDING_EMAIL_MAX_LENGTH ||
      !BRANDING_EMAIL_PATTERN.test(contactEmail))
  ) {
    issues.push(
      issueAt(fieldPath(VALUE_PATH, 'contactEmail'), CONSTRAINTS.invalidEmail),
    );
  }
  return {
    ...(logoMediaKey === undefined ? {} : { logoMediaKey }),
    ...(accentColor === undefined ? {} : { accentColor }),
    ...(footerText === undefined ? {} : { footerText }),
    ...(contactEmail === undefined ? {} : { contactEmail }),
  };
}

export function validateReportBrandingValue(
  value: unknown,
): SettingValueResultFor<ReportBrandingValue> {
  const issues: ValidationIssue[] = [];
  const root = readRootObject(value, REPORT_BRANDING_KEYS, issues);
  if (root === null) {
    return rejected(issues);
  }
  const displayName = readDisplayName(root, issues);
  const optionals = readBrandingOptionals(root, issues);
  if (issues.length > 0 || displayName === null) {
    return rejected(issues);
  }
  return accepted({ displayName, ...optionals });
}

// --- Registry & classification ------------------------------------------------

/**
 * Per-key validator registry. `Record<SettingKey, ...>` keeps it compile-time
 * exhaustive: adding a 9th `SettingKey` without a validator fails the build.
 */
export const SETTING_VALUE_VALIDATORS: Readonly<
  Record<SettingKey, SettingValueValidator>
> = {
  [SettingKey.AttendanceStatuses]: validateAttendanceStatusesValue,
  [SettingKey.SessionTypes]: validateSessionTypesValue,
  [SettingKey.AttendanceWeights]: validateAttendanceWeightsValue,
  [SettingKey.AssessmentScale]: validateAssessmentScaleValue,
  [SettingKey.BadgeTiers]: validateBadgeTiersValue,
  [SettingKey.RosterLimits]: validateRosterLimitsValue,
  [SettingKey.NotificationRules]: validateNotificationRulesValue,
  [SettingKey.ReportBranding]: validateReportBrandingValue,
};

// Map mirror of the registry for injection-safe dynamic dispatch.
const SETTING_VALUE_VALIDATOR_MAP: ReadonlyMap<string, SettingValueValidator> =
  new Map(Object.entries(SETTING_VALUE_VALIDATORS));

export function validateSettingValue(
  key: SettingKey,
  value: unknown,
): SettingValueResult {
  const validator = SETTING_VALUE_VALIDATOR_MAP.get(key);
  if (validator === undefined) {
    return rejected([issueAt('settingKey', CONSTRAINTS.invalidType)]);
  }
  return validator(value);
}

/** Read-time classification of one stored version (D4). */
export function classifySettingValueState(
  version: SettingVersion,
): SettingValueState {
  const result = validateSettingValue(version.settingKey, version.value);
  return result.ok ? SettingValueState.Valid : SettingValueState.Legacy;
}

/**
 * A stored version enriched with its `valueState` for the versions listing.
 * The raw stored document stays visible — the honest legacy display and the
 * replace flow need it (D4).
 */
export function classifySettingVersion(
  version: SettingVersion,
): ClassifiedSettingVersion {
  return { ...version, valueState: classifySettingValueState(version) };
}

/**
 * Classify a stored version for snapshot assembly: legacy values resolve to a
 * null typed value so downstream math can never consume nonsense (D4).
 */
export function classifyEffectiveVersion(
  version: SettingVersion,
): ClassifiedEffectiveVersion {
  const result = validateSettingValue(version.settingKey, version.value);
  return {
    settingKey: version.settingKey,
    effectiveFrom: version.effectiveFrom,
    valueState: result.ok ? SettingValueState.Valid : SettingValueState.Legacy,
    value: result.ok ? result.value : null,
  };
}

/**
 * Key-indexed narrowing guards. The per-key validators guarantee the invariant
 * (a value stored/accepted under a key parses as that key's shape); the guards
 * make that invariant explicit to the type system at call sites.
 */
export function isAttendanceStatusesValue(
  key: SettingKey,
  value: TypedSettingValue,
): value is AttendanceStatusesValue {
  return key === SettingKey.AttendanceStatuses && 'statuses' in value;
}

export function isAttendanceWeightsValue(
  key: SettingKey,
  value: TypedSettingValue,
): value is AttendanceWeightsValue {
  return key === SettingKey.AttendanceWeights && 'weights' in value;
}

export function isRosterLimitsValue(
  key: SettingKey,
  value: TypedSettingValue,
): value is RosterLimitsValue {
  return key === SettingKey.RosterLimits && 'roster' in value;
}
