import { SETTING_KEY_VALUES } from '../model/teams.enums';
import type {
  EffectiveSetting,
  SettingsSnapshot,
  SettingVersion,
} from '../model/teams.types';

/**
 * Pure assembly of the deterministic effective-settings snapshot used by
 * downstream calculations. Given the single in-effect version per setting key
 * (already selected as-of a point in time), produce one `EffectiveSetting` for
 * every known key in a stable order. A key with no in-effect version resolves to
 * a null value — null-not-zero: "not configured" is explicit and never silently
 * substituted with an empty or zero default.
 */
export function buildSettingsSnapshot(
  teamId: string,
  asOf: Date,
  effective: readonly SettingVersion[],
): SettingsSnapshot {
  const byKey = new Map<string, SettingVersion>();
  for (const version of effective) {
    byKey.set(version.settingKey, version);
  }

  const settings: readonly EffectiveSetting[] = SETTING_KEY_VALUES.map(key => {
    const version = byKey.get(key);
    return {
      settingKey: key,
      effectiveFrom: version === undefined ? null : version.effectiveFrom,
      value: version === undefined ? null : version.value,
    };
  });

  return { teamId, asOf, settings };
}
