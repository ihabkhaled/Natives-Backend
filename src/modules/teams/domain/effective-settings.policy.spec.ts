import { describe, expect, it } from 'vitest';

import {
  VALID_ATTENDANCE_STATUSES,
  VALID_ATTENDANCE_WEIGHTS,
  VALID_BADGE_TIERS,
} from '../../../../test/fixtures/setting-values.fixture';
import { SettingValueState } from '../model/setting-values.enums';
import { SETTING_KEY_VALUES, SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import { buildSettingsSnapshot } from './effective-settings.policy';
import { classifyEffectiveVersion } from './setting-value.policy';

const TEAM = 'team-1';
const AS_OF = new Date('2026-06-01T00:00:00.000Z');

function version(overrides: Partial<SettingVersion>): SettingVersion {
  return {
    id: 'v1',
    teamId: TEAM,
    settingKey: SettingKey.BadgeTiers,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    value: VALID_BADGE_TIERS,
    note: null,
    createdBy: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function snapshotOf(versions: readonly SettingVersion[]) {
  return buildSettingsSnapshot(
    TEAM,
    AS_OF,
    versions.map(entry => classifyEffectiveVersion(entry)),
  );
}

function entryFor(snapshot: ReturnType<typeof snapshotOf>, key: SettingKey) {
  return snapshot.settings.find(setting => setting.settingKey === key);
}

describe('effective-settings.policy', () => {
  it('emits one entry per known key in a stable order', () => {
    const snapshot = snapshotOf([]);

    expect(snapshot.teamId).toBe(TEAM);
    expect(snapshot.asOf).toBe(AS_OF);
    expect(snapshot.settings).toHaveLength(SETTING_KEY_VALUES.length);
    expect(snapshot.settings.map(entry => entry.settingKey)).toEqual([
      ...SETTING_KEY_VALUES,
    ]);
  });

  it('resolves a configured key and leaves unconfigured keys null', () => {
    const snapshot = snapshotOf([version({})]);
    const tiers = entryFor(snapshot, SettingKey.BadgeTiers);
    const scale = entryFor(snapshot, SettingKey.AssessmentScale);

    expect(tiers?.value).toEqual(VALID_BADGE_TIERS);
    expect(tiers?.valueState).toBe(SettingValueState.Valid);
    expect(tiers?.effectiveFrom).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    // Null-not-zero: an unconfigured setting is explicitly null, never a default.
    expect(scale?.value).toBeNull();
    expect(scale?.valueState).toBeNull();
    expect(scale?.effectiveFrom).toBeNull();
    expect(scale?.issues).toEqual([]);
  });

  it('never serves a legacy value as effective (D4)', () => {
    const snapshot = snapshotOf([
      version({ settingKey: SettingKey.BadgeTiers, value: {} }),
    ]);
    const tiers = entryFor(snapshot, SettingKey.BadgeTiers);

    expect(tiers?.valueState).toBe(SettingValueState.Legacy);
    expect(tiers?.value).toBeNull();
    expect(tiers?.effectiveFrom).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('surfaces weight-coverage issues when statuses drift (D3)', () => {
    const snapshot = snapshotOf([
      version({
        settingKey: SettingKey.AttendanceStatuses,
        value: VALID_ATTENDANCE_STATUSES,
      }),
      version({
        id: 'v2',
        settingKey: SettingKey.AttendanceWeights,
        value: { weights: { present_on_time: 1, absent: 0 } },
      }),
    ]);
    const weights = entryFor(snapshot, SettingKey.AttendanceWeights);

    expect(weights?.valueState).toBe(SettingValueState.Valid);
    expect(weights?.issues).toContain('weights_missing_status:present_late');
  });

  it('flags weights configured without statuses (D3)', () => {
    const snapshot = snapshotOf([
      version({
        settingKey: SettingKey.AttendanceWeights,
        value: VALID_ATTENDANCE_WEIGHTS,
      }),
    ]);
    const weights = entryFor(snapshot, SettingKey.AttendanceWeights);

    expect(weights?.issues).toEqual(['statuses_not_configured']);
  });

  it('reports no weight issues when coverage is complete', () => {
    const snapshot = snapshotOf([
      version({
        settingKey: SettingKey.AttendanceStatuses,
        value: VALID_ATTENDANCE_STATUSES,
      }),
      version({
        id: 'v2',
        settingKey: SettingKey.AttendanceWeights,
        value: VALID_ATTENDANCE_WEIGHTS,
      }),
    ]);
    const weights = entryFor(snapshot, SettingKey.AttendanceWeights);

    expect(weights?.issues).toEqual([]);
    expect(weights?.value).toEqual(VALID_ATTENDANCE_WEIGHTS);
  });

  it('treats legacy statuses as not configured for issue surfacing', () => {
    const snapshot = snapshotOf([
      version({ settingKey: SettingKey.AttendanceStatuses, value: {} }),
      version({
        id: 'v2',
        settingKey: SettingKey.AttendanceWeights,
        value: VALID_ATTENDANCE_WEIGHTS,
      }),
    ]);
    const weights = entryFor(snapshot, SettingKey.AttendanceWeights);

    expect(weights?.issues).toEqual(['statuses_not_configured']);
  });
});
