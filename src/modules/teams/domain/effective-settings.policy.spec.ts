import { describe, expect, it } from 'vitest';

import { SETTING_KEY_VALUES, SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import { buildSettingsSnapshot } from './effective-settings.policy';

const TEAM = 'team-1';
const AS_OF = new Date('2026-06-01T00:00:00.000Z');

function version(overrides: Partial<SettingVersion>): SettingVersion {
  return {
    id: 'v1',
    teamId: TEAM,
    settingKey: SettingKey.AttendanceWeights,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    value: { practice: 3 },
    note: null,
    createdBy: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('effective-settings.policy', () => {
  it('emits one entry per known key in a stable order', () => {
    const snapshot = buildSettingsSnapshot(TEAM, AS_OF, []);

    expect(snapshot.teamId).toBe(TEAM);
    expect(snapshot.asOf).toBe(AS_OF);
    expect(snapshot.settings).toHaveLength(SETTING_KEY_VALUES.length);
    expect(snapshot.settings.map(entry => entry.settingKey)).toEqual([
      ...SETTING_KEY_VALUES,
    ]);
  });

  it('resolves a configured key and leaves unconfigured keys null', () => {
    const effective = [
      version({
        settingKey: SettingKey.AttendanceWeights,
        value: { practice: 3, throwing: 4 },
      }),
    ];

    const snapshot = buildSettingsSnapshot(TEAM, AS_OF, effective);
    const weights = snapshot.settings.find(
      entry => entry.settingKey === SettingKey.AttendanceWeights,
    );
    const scale = snapshot.settings.find(
      entry => entry.settingKey === SettingKey.AssessmentScale,
    );

    expect(weights?.value).toEqual({ practice: 3, throwing: 4 });
    expect(weights?.effectiveFrom).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
    // Null-not-zero: an unconfigured setting is explicitly null, never a default.
    expect(scale?.value).toBeNull();
    expect(scale?.effectiveFrom).toBeNull();
  });
});
