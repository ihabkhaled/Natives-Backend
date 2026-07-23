import type {
  AttendanceStatusesValue,
  AttendanceWeightsValue,
  ClassifiedEffectiveVersion,
} from '../model/setting-values.types';
import { SETTING_KEY_VALUES, SettingKey } from '../model/teams.enums';
import type { EffectiveSetting, SettingsSnapshot } from '../model/teams.types';
import { collectSnapshotIssues } from './setting-cross-references.policy';
import {
  isAttendanceStatusesValue,
  isAttendanceWeightsValue,
} from './setting-value.policy';

/**
 * Pure assembly of the deterministic effective-settings snapshot used by
 * downstream calculations. Given the single in-effect CLASSIFIED version per
 * setting key (already selected as-of a point in time, D4), produce one
 * `EffectiveSetting` for every known key in a stable order. A key with no
 * in-effect version resolves to a null value — null-not-zero — and a legacy
 * value is ALSO served as null (never as an unvalidated document); cross-setting
 * gaps between weights and statuses surface as per-key issues (D3).
 */
export function buildSettingsSnapshot(
  teamId: string,
  asOf: Date,
  classified: readonly ClassifiedEffectiveVersion[],
): SettingsSnapshot {
  const byKey = new Map<SettingKey, ClassifiedEffectiveVersion>();
  for (const entry of classified) {
    byKey.set(entry.settingKey, entry);
  }

  const weightsIssues = collectSnapshotIssues(
    effectiveStatuses(byKey),
    effectiveWeights(byKey),
  );
  const settings: readonly EffectiveSetting[] = SETTING_KEY_VALUES.map(key =>
    toEffectiveSetting(key, byKey.get(key), weightsIssues),
  );

  return { teamId, asOf, settings };
}

function effectiveStatuses(
  byKey: ReadonlyMap<SettingKey, ClassifiedEffectiveVersion>,
): AttendanceStatusesValue | null {
  const entry = byKey.get(SettingKey.AttendanceStatuses);
  if (entry === undefined) {
    return null;
  }
  if (entry.value === null) {
    return null;
  }
  return isAttendanceStatusesValue(entry.settingKey, entry.value)
    ? entry.value
    : null;
}

function effectiveWeights(
  byKey: ReadonlyMap<SettingKey, ClassifiedEffectiveVersion>,
): AttendanceWeightsValue | null {
  const entry = byKey.get(SettingKey.AttendanceWeights);
  if (entry === undefined) {
    return null;
  }
  if (entry.value === null) {
    return null;
  }
  return isAttendanceWeightsValue(entry.settingKey, entry.value)
    ? entry.value
    : null;
}

function toEffectiveSetting(
  key: SettingKey,
  entry: ClassifiedEffectiveVersion | undefined,
  weightsIssues: readonly string[],
): EffectiveSetting {
  if (entry === undefined) {
    return {
      settingKey: key,
      effectiveFrom: null,
      value: null,
      valueState: null,
      issues: [],
    };
  }
  return {
    settingKey: key,
    effectiveFrom: entry.effectiveFrom,
    value: entry.value,
    valueState: entry.valueState,
    issues: key === SettingKey.AttendanceWeights ? weightsIssues : [],
  };
}
