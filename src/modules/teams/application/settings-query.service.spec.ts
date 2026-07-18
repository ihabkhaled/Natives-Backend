import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTING_KEY_VALUES, SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import { SettingsQueryService } from './settings-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

const EFFECTIVE: SettingVersion = {
  id: 'sv-1',
  teamId: 'team-1',
  settingKey: SettingKey.AttendanceWeights,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  value: { practice: 3 },
  note: null,
  createdBy: null,
  createdAt: NOW,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const settings = {
    loadEffective: vi.fn().mockResolvedValue([EFFECTIVE]),
    listForKey: vi.fn().mockResolvedValue({ items: [], total: 0 }),
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

  it('lists versions for a key through the repository', async () => {
    const page = { limit: 20, offset: 0 };
    await harness.service.listVersions(
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
  });
});
