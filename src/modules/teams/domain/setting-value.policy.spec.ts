import { describe, expect, it } from 'vitest';

import {
  AUDIT_NONSENSE_PAYLOAD,
  VALID_SETTING_DOCUMENTS,
} from '../../../../test/fixtures/setting-values.fixture';
import { SettingValueState } from '../model/setting-values.enums';
import { SETTING_KEY_VALUES, SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import {
  classifyEffectiveVersion,
  classifySettingValueState,
  isAttendanceStatusesValue,
  isAttendanceWeightsValue,
  isRosterLimitsValue,
  SETTING_VALUE_VALIDATORS,
  validateSettingValue,
} from './setting-value.policy';

function constraintsFor(key: SettingKey, value: unknown): readonly string[] {
  const result = validateSettingValue(key, value);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues.map(issue => issue.constraint);
}

function fieldsFor(key: SettingKey, value: unknown): readonly string[] {
  const result = validateSettingValue(key, value);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues.map(issue => issue.field);
}

function without(
  target: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(target).filter(([key]) => key !== field),
  );
}

function statusEntry(
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    code: 'present_on_time',
    labelEn: 'On time',
    labelAr: 'في الموعد',
    color: 'success',
    countsTowardMetrics: true,
    allowSelfCheckIn: true,
    active: true,
    ...overrides,
  };
}

function poles(): readonly Record<string, unknown>[] {
  return [
    statusEntry({}),
    statusEntry({ code: 'absent', labelEn: 'Absent', color: 'danger' }),
  ];
}

function sessionType(
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    code: 'practice',
    labelEn: 'Practice',
    labelAr: 'تدريب',
    color: 'primary',
    active: true,
    ...overrides,
  };
}

function tier(
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    key: 'bronze',
    labelEn: 'Bronze',
    labelAr: 'برونزي',
    threshold: 100,
    color: 'accent2',
    ...overrides,
  };
}

function band(
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    key: 'solid',
    labelEn: 'Solid',
    labelAr: 'ثابت',
    from: 1,
    to: 2,
    ...overrides,
  };
}

function reminderRule(
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    event: 'practice_reminder',
    enabled: true,
    channels: ['push'],
    leadHours: 24,
    recipients: 'members',
    ...overrides,
  };
}

describe('setting-value.policy', () => {
  describe('registry & regression pins', () => {
    it('accepts the canonical valid document for every key', () => {
      for (const key of SETTING_KEY_VALUES) {
        const document = VALID_SETTING_DOCUMENTS[key];
        expect(document).toBeDefined();
        const result = validateSettingValue(key, document);
        expect(result.ok, `expected ${key} fixture to be valid`).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(document);
        }
      }
    });

    it('rejects the audit nonsense payload for every key (regression pin)', () => {
      for (const key of SETTING_KEY_VALUES) {
        const result = validateSettingValue(key, AUDIT_NONSENSE_PAYLOAD);
        expect(result.ok, `expected ${key} to reject nonsense`).toBe(false);
        if (!result.ok) {
          expect(
            result.issues.some(
              issue => issue.constraint === 'unexpected_property',
            ),
          ).toBe(true);
        }
      }
    });

    it('rejects an empty object and a non-object for every key', () => {
      for (const key of SETTING_KEY_VALUES) {
        expect(validateSettingValue(key, {}).ok).toBe(false);
        expect(validateSettingValue(key, []).ok).toBe(false);
        expect(validateSettingValue(key, 'nonsense').ok).toBe(false);
        expect(validateSettingValue(key, null).ok).toBe(false);
      }
    });

    it('registers a validator for every setting key', () => {
      for (const key of SETTING_KEY_VALUES) {
        expect(typeof SETTING_VALUE_VALIDATORS[key]).toBe('function');
      }
    });
  });

  describe('attendance_statuses', () => {
    const key = SettingKey.AttendanceStatuses;

    it.each([
      ['unknown code', [statusEntry({ code: 'vibing' })], 'invalid_code'],
      [
        'duplicate codes',
        [...poles(), statusEntry({})],
        'duplicate_code:present_on_time',
      ],
      ['missing absent pole', [statusEntry({})], 'missing_pole:absent'],
      [
        'inactive pole',
        [statusEntry({}), statusEntry({ code: 'absent', active: false })],
        'missing_pole:absent',
      ],
      ['empty list', [], 'too_few_entries'],
      [
        'boolean as string',
        [statusEntry({ countsTowardMetrics: 'yes' })],
        'invalid_type',
      ],
      [
        'missing label',
        [without(statusEntry({}), 'labelAr')],
        'missing_property',
      ],
      [
        'overlong label',
        [statusEntry({ labelEn: 'x'.repeat(61) })],
        'invalid_label',
      ],
      ['raw hex color', [statusEntry({ color: '#ff0000' })], 'invalid_color'],
      [
        'entry extra property',
        [statusEntry({ sneaky: true })],
        'unexpected_property',
      ],
      ['non-object entry', ['present_on_time'], 'invalid_type'],
    ])('rejects %s', (_label, statuses, constraint) => {
      expect(constraintsFor(key, { statuses })).toContain(constraint);
    });

    it('rejects a sheet with no counts-toward active status', () => {
      const statuses = [
        statusEntry({ countsTowardMetrics: false }),
        statusEntry({
          code: 'absent',
          countsTowardMetrics: false,
        }),
      ];
      expect(constraintsFor(key, { statuses })).toContain('no_metric_status');
    });

    it('rejects more than seven entries', () => {
      const statuses = Array.from({ length: 8 }, () => statusEntry({}));
      expect(constraintsFor(key, { statuses })).toContain('too_many_entries');
    });

    it('reports unexpected root properties with their field path', () => {
      const fields = fieldsFor(key, {
        statuses: poles(),
        totally: 'unrelated',
      });
      expect(fields).toContain('value.totally');
    });
  });

  describe('session_types', () => {
    const key = SettingKey.SessionTypes;

    it.each([
      ['bad code pattern', [sessionType({ code: 'Bad-Code' })], 'invalid_code'],
      [
        'duplicate code',
        [sessionType({}), sessionType({})],
        'duplicate_code:practice',
      ],
      ['no active entry', [sessionType({ active: false })], 'no_active_entry'],
      [
        'duration below slot',
        [sessionType({ defaultDurationMinutes: 10 })],
        'out_of_range',
      ],
      [
        'duration above slot',
        [sessionType({ defaultDurationMinutes: 481 })],
        'out_of_range',
      ],
      [
        'fractional duration',
        [sessionType({ defaultDurationMinutes: 90.5 })],
        'invalid_type',
      ],
      ['empty list', [], 'too_few_entries'],
    ])('rejects %s', (_label, types, constraint) => {
      expect(constraintsFor(key, { types })).toContain(constraint);
    });

    it('rejects more than 24 entries', () => {
      const types = Array.from({ length: 25 }, (_, index) =>
        sessionType({ code: `type_${String(index)}` }),
      );
      expect(constraintsFor(key, { types })).toContain('too_many_entries');
    });

    it('accepts an entry without a default duration', () => {
      const result = validateSettingValue(key, {
        types: [sessionType({})],
      });
      expect(result.ok).toBe(true);
      if (result.ok && 'types' in result.value) {
        expect(result.value.types[0]).not.toHaveProperty(
          'defaultDurationMinutes',
        );
      }
    });
  });

  describe('attendance_weights', () => {
    const key = SettingKey.AttendanceWeights;

    it.each([
      ['negative weight', { present_on_time: -0.1 }, 'out_of_range'],
      ['weight above one', { present_on_time: 1.5 }, 'out_of_range'],
      ['four decimals', { present_on_time: 0.1234 }, 'too_many_decimals'],
      ['string weight', { present_on_time: '1' }, 'invalid_type'],
      ['non-finite weight', { present_on_time: Infinity }, 'invalid_type'],
      ['bad status code', { 'Not-Snake': 1 }, 'invalid_code:Not-Snake'],
    ])('rejects %s', (_label, weights, constraint) => {
      expect(constraintsFor(key, { weights })).toContain(constraint);
    });

    it('rejects a non-object weights field and extra root keys', () => {
      expect(constraintsFor(key, { weights: [1] })).toContain('invalid_type');
      expect(constraintsFor(key, { weights: {}, extra: 1 })).toContain(
        'unexpected_property',
      );
    });

    it('accepts three-decimal weights', () => {
      const result = validateSettingValue(key, {
        weights: { present_on_time: 0.125 },
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('assessment_scale', () => {
    const key = SettingKey.AssessmentScale;

    it.each([
      ['min equal to max', { min: 5, max: 5, step: 1 }, 'min_not_below_max'],
      ['min above max', { min: 6, max: 5, step: 1 }, 'min_not_below_max'],
      ['negative min', { min: -1, max: 5, step: 1 }, 'out_of_range'],
      ['max above 100', { min: 0, max: 101, step: 1 }, 'out_of_range'],
      ['zero step', { min: 1, max: 5, step: 0 }, 'out_of_range'],
      ['non-divisor step', { min: 0, max: 5, step: 2 }, 'step_not_divisor'],
      ['fractional min', { min: 0.5, max: 5, step: 1 }, 'invalid_type'],
      ['missing step', { min: 1, max: 5 }, 'missing_property'],
    ])('rejects %s', (_label, document, constraint) => {
      expect(constraintsFor(key, document)).toContain(constraint);
    });

    it.each([
      ['band from above to', [band({ from: 3, to: 2 })], 'band_outside_scale'],
      ['band beyond max', [band({ from: 4, to: 6 })], 'band_outside_scale'],
      [
        'overlapping bands',
        [band({}), band({ key: 'high', from: 2, to: 3 })],
        'band_overlap',
      ],
      [
        'duplicate band keys',
        [band({}), band({ from: 3, to: 4 })],
        'duplicate_code:solid',
      ],
      ['non-object band', ['low'], 'invalid_type'],
    ])('rejects %s', (_label, bands, constraint) => {
      expect(constraintsFor(key, { min: 1, max: 5, step: 1, bands })).toContain(
        constraint,
      );
    });

    it('rejects more than ten bands', () => {
      const bands = Array.from({ length: 11 }, (_, index) =>
        band({ key: `band_${String(index)}` }),
      );
      expect(constraintsFor(key, { min: 1, max: 5, step: 1, bands })).toContain(
        'too_many_entries',
      );
    });

    it('accepts a gapped, banded scale and a bandless scale', () => {
      expect(
        validateSettingValue(key, {
          min: 0,
          max: 10,
          step: 5,
          bands: [
            band({ from: 0, to: 1 }),
            band({ key: 'top', from: 9, to: 10 }),
          ],
        }).ok,
      ).toBe(true);
      expect(validateSettingValue(key, { min: 1, max: 5, step: 1 }).ok).toBe(
        true,
      );
    });
  });

  describe('badge_tiers', () => {
    const key = SettingKey.BadgeTiers;

    it.each([
      [
        'descending thresholds',
        [tier({}), tier({ key: 'silver', threshold: 50 })],
        'threshold_not_ascending',
      ],
      [
        'duplicate thresholds',
        [tier({}), tier({ key: 'silver', threshold: 100 })],
        'threshold_not_ascending',
      ],
      [
        'duplicate keys',
        [tier({}), tier({ threshold: 200 })],
        'duplicate_code:bronze',
      ],
      ['negative threshold', [tier({ threshold: -1 })], 'out_of_range'],
      ['threshold above cap', [tier({ threshold: 100001 })], 'out_of_range'],
      ['empty list', [], 'too_few_entries'],
      ['non-object tier', [42], 'invalid_type'],
    ])('rejects %s', (_label, tiers, constraint) => {
      expect(constraintsFor(key, { tiers })).toContain(constraint);
    });

    it('rejects more than ten tiers', () => {
      const tiers = Array.from({ length: 11 }, (_, index) =>
        tier({ key: `tier_${String(index)}`, threshold: 100 + index }),
      );
      expect(constraintsFor(key, { tiers })).toContain('too_many_entries');
    });
  });

  describe('roster_limits', () => {
    const key = SettingKey.RosterLimits;

    it.each([
      [
        'roster min above max',
        { roster: { min: 30, max: 20 } },
        'min_not_below_max',
      ],
      ['roster max above 100', { roster: { max: 101 } }, 'out_of_range'],
      ['zero roster max', { roster: { max: 0 } }, 'out_of_range'],
      [
        'squad below a line',
        { roster: { max: 27 }, matchSquad: { max: 6 } },
        'squad_below_line',
      ],
      [
        'squad above roster',
        { roster: { max: 10 }, matchSquad: { max: 12 } },
        'squad_exceeds_roster',
      ],
      [
        'duplicate position keys',
        {
          roster: { max: 27 },
          perPosition: [
            { positionKey: 'handler', max: 5 },
            { positionKey: 'handler', max: 3 },
          ],
        },
        'duplicate_code:handler',
      ],
      [
        'position capacity below squad min',
        {
          roster: { max: 27 },
          matchSquad: { min: 12, max: 15 },
          perPosition: [{ positionKey: 'handler', max: 5 }],
        },
        'position_cap_below_squad_min',
      ],
      ['missing roster', { matchSquad: { max: 7 } }, 'missing_property'],
      ['non-object roster', { roster: 27 }, 'invalid_type'],
      [
        'zero position cap',
        {
          roster: { max: 27 },
          perPosition: [{ positionKey: 'handler', max: 0 }],
        },
        'out_of_range',
      ],
    ])('rejects %s', (_label, document, constraint) => {
      expect(constraintsFor(key, document)).toContain(constraint);
    });

    it('accepts a roster-only document', () => {
      expect(validateSettingValue(key, { roster: { max: 27 } }).ok).toBe(true);
    });
  });

  describe('notification_rules', () => {
    const key = SettingKey.NotificationRules;

    it.each([
      [
        'unknown event',
        [reminderRule({ event: 'moon_phase' })],
        'unknown_event',
      ],
      [
        'duplicate events',
        [reminderRule({}), reminderRule({})],
        'duplicate_event:practice_reminder',
      ],
      [
        'enabled without channels',
        [reminderRule({ channels: [] })],
        'no_channel',
      ],
      [
        'duplicate channel',
        [reminderRule({ channels: ['push', 'push'] })],
        'duplicate_channel:push',
      ],
      [
        'unknown channel',
        [reminderRule({ channels: ['fax'] })],
        'invalid_type',
      ],
      [
        'lead hours on the wrong event',
        [
          reminderRule({
            event: 'practice_change',
            leadHours: 4,
          }),
        ],
        'lead_hours_forbidden',
      ],
      [
        'missing lead hours on reminder',
        [reminderRule({ leadHours: undefined })],
        'lead_hours_required',
      ],
      ['zero lead hours', [reminderRule({ leadHours: 0 })], 'out_of_range'],
      [
        'lead hours above a week',
        [reminderRule({ leadHours: 169 })],
        'out_of_range',
      ],
      [
        'unknown recipients',
        [reminderRule({ recipients: 'everyone' })],
        'invalid_type',
      ],
      ['non-object rule', ['reminder'], 'invalid_type'],
    ])('rejects %s', (_label, rules, constraint) => {
      expect(constraintsFor(key, { rules })).toContain(constraint);
    });

    it.each([
      ['malformed time', { start: '25:00', end: '07:00' }, 'invalid_time'],
      [
        'equal boundaries',
        { start: '22:00', end: '22:00' },
        'quiet_hours_equal',
      ],
      ['non-object window', 'night', 'invalid_type'],
    ])('rejects quiet hours with %s', (_label, quietHours, constraint) => {
      expect(
        constraintsFor(key, { rules: [reminderRule({})], quietHours }),
      ).toContain(constraint);
    });

    it('accepts an overnight quiet-hours window (wrap intended)', () => {
      const result = validateSettingValue(key, {
        rules: [reminderRule({})],
        quietHours: { start: '22:00', end: '07:00' },
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('report_branding', () => {
    const key = SettingKey.ReportBranding;

    it.each([
      ['blank display name', { displayName: '   ' }, 'blank_text'],
      [
        'overlong display name',
        { displayName: 'x'.repeat(81) },
        'out_of_range',
      ],
      [
        'named accent color',
        { displayName: 'Natives', accentColor: 'green' },
        'invalid_accent_color',
      ],
      [
        'short hex accent',
        { displayName: 'Natives', accentColor: '#12ab' },
        'invalid_accent_color',
      ],
      [
        'overlong footer',
        { displayName: 'Natives', footerText: 'x'.repeat(201) },
        'out_of_range',
      ],
      [
        'invalid email',
        { displayName: 'Natives', contactEmail: 'nope' },
        'invalid_email',
      ],
      [
        'empty logo key',
        { displayName: 'Natives', logoMediaKey: '' },
        'out_of_range',
      ],
      ['numeric display name', { displayName: 7 }, 'invalid_type'],
      [
        'unexpected property',
        { displayName: 'Natives', theme: 'dark' },
        'unexpected_property',
      ],
    ])('rejects %s', (_label, document, constraint) => {
      expect(constraintsFor(key, document)).toContain(constraint);
    });

    it('accepts a minimal document with only a display name', () => {
      expect(validateSettingValue(key, { displayName: 'Natives' }).ok).toBe(
        true,
      );
    });
  });

  describe('classification (D4)', () => {
    const legacyVersion: SettingVersion = {
      id: 'sv-legacy',
      teamId: 'team-1',
      settingKey: SettingKey.AttendanceStatuses,
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      value: {},
      note: null,
      createdBy: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    it('classifies a legacy row and resolves its value to null', () => {
      expect(classifySettingValueState(legacyVersion)).toBe(
        SettingValueState.Legacy,
      );
      const classified = classifyEffectiveVersion(legacyVersion);
      expect(classified.valueState).toBe(SettingValueState.Legacy);
      expect(classified.value).toBeNull();
    });

    it('classifies a valid row and keeps its typed value', () => {
      const validDocument = VALID_SETTING_DOCUMENTS['badge_tiers'];
      const version: SettingVersion = {
        ...legacyVersion,
        settingKey: SettingKey.BadgeTiers,
        value: validDocument ?? {},
      };
      expect(classifySettingValueState(version)).toBe(SettingValueState.Valid);
      const classified = classifyEffectiveVersion(version);
      expect(classified.valueState).toBe(SettingValueState.Valid);
      expect(classified.value).toEqual(validDocument);
    });
  });

  describe('narrowing guards', () => {
    it('narrows only the matching key', () => {
      const statuses = validateSettingValue(
        SettingKey.AttendanceStatuses,
        VALID_SETTING_DOCUMENTS['attendance_statuses'],
      );
      const weights = validateSettingValue(
        SettingKey.AttendanceWeights,
        VALID_SETTING_DOCUMENTS['attendance_weights'],
      );
      const roster = validateSettingValue(
        SettingKey.RosterLimits,
        VALID_SETTING_DOCUMENTS['roster_limits'],
      );
      if (statuses.ok && weights.ok && roster.ok) {
        expect(
          isAttendanceStatusesValue(
            SettingKey.AttendanceStatuses,
            statuses.value,
          ),
        ).toBe(true);
        expect(
          isAttendanceStatusesValue(
            SettingKey.AttendanceWeights,
            weights.value,
          ),
        ).toBe(false);
        expect(
          isAttendanceWeightsValue(SettingKey.AttendanceWeights, weights.value),
        ).toBe(true);
        expect(isRosterLimitsValue(SettingKey.RosterLimits, roster.value)).toBe(
          true,
        );
      }
    });

    it('defensively rejects a key outside the registry', () => {
      const bogusKey = 'not_a_setting' as SettingKey;
      const result = validateSettingValue(bogusKey, {});
      expect(result.ok).toBe(false);
    });
  });
});
