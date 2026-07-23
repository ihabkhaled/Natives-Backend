import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VALID_ATTENDANCE_WEIGHTS,
  VALID_BADGE_TIERS,
} from '../../../../test/fixtures/setting-values.fixture';
import { SettingValueState } from '../model/setting-values.enums';
import { SETTING_KEY_VALUES, SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import { SettingsQueryService } from './settings-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

const EFFECTIVE: SettingVersion = {
  id: 'sv-1',
  teamId: 'team-1',
  settingKey: SettingKey.BadgeTiers,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  value: VALID_BADGE_TIERS,
  note: null,
  createdBy: null,
  createdAt: NOW,
};

const LEGACY: SettingVersion = {
  ...EFFECTIVE,
  id: 'sv-legacy',
  settingKey: SettingKey.AttendanceWeights,
  value: { totally: 'unrelated', nonsense: 123 },
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const settings = {
    loadEffective: vi.fn().mockResolvedValue([EFFECTIVE]),
    listForKey: vi.fn().mockResolvedValue({
      items: [EFFECTIVE, LEGACY],
      total: 2,
      limit: 20,
      offset: 0,
    }),
  };
  const service = new SettingsQueryService(
    unitOfWork as never,
    clock,
    settings as never,
  );
  return { service, settings };
}

describe('SettingsQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('builds a snapshot as-of an explicit instant', async () => {
    const snapshot = await harness.service.getSnapshot(
      'team-1',
      '2026-03-01T00:00:00.000Z',
    );
    expect(snapshot.asOf).toEqual(new Date('2026-03-01T00:00:00.000Z'));
    expect(snapshot.settings).toHaveLength(SETTING_KEY_VALUES.length);
    expect(harness.settings.loadEffective).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      new Date('2026-03-01T00:00:00.000Z'),
    );
  });

  it('defaults the snapshot instant to the clock when omitted', async () => {
    const snapshot = await harness.service.getSnapshot('team-1', null);
    expect(snapshot.asOf).toEqual(NOW);
  });

  it('classifies snapshot values and nulls legacy documents (D4)', async () => {
    harness.settings.loadEffective.mockResolvedValue([EFFECTIVE, LEGACY]);
    const snapshot = await harness.service.getSnapshot('team-1', null);
    const tiers = snapshot.settings.find(
      entry => entry.settingKey === SettingKey.BadgeTiers,
    );
    const weights = snapshot.settings.find(
      entry => entry.settingKey === SettingKey.AttendanceWeights,
    );
    expect(tiers?.valueState).toBe(SettingValueState.Valid);
    expect(tiers?.value).toEqual(VALID_BADGE_TIERS);
    expect(weights?.valueState).toBe(SettingValueState.Legacy);
    expect(weights?.value).toBeNull();
  });

  it('lists versions with a read-time valueState per row', async () => {
    const page = { limit: 20, offset: 0 };
    const result = await harness.service.listVersions(
      'team-1',
      SettingKey.AttendanceWeights,
      page,
    );
    expect(harness.settings.listForKey).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      SettingKey.AttendanceWeights,
      page,
    );
    expect(result.items[0]?.valueState).toBe(SettingValueState.Valid);
    expect(result.items[1]?.valueState).toBe(SettingValueState.Legacy);
    // The raw stored document stays visible for the legacy replace flow.
    expect(result.items[1]?.value).toEqual(LEGACY.value);
  });

  it('keeps snapshot weight issues wired through the policy (D3)', async () => {
    harness.settings.loadEffective.mockResolvedValue([
      {
        ...LEGACY,
        id: 'sv-weights',
        value: VALID_ATTENDANCE_WEIGHTS,
      },
    ]);
    const snapshot = await harness.service.getSnapshot('team-1', null);
    const weights = snapshot.settings.find(
      entry => entry.settingKey === SettingKey.AttendanceWeights,
    );
    expect(weights?.issues).toEqual(['statuses_not_configured']);
  });
});
