import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingVersionConflictError } from '../errors/setting-version-conflict.error';
import { SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import { CreateSettingVersionUseCase } from './create-setting-version.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const VERSION: SettingVersion = {
  id: 'sv-1',
  teamId: 'team-1',
  settingKey: SettingKey.AttendanceWeights,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  value: { practice: 3 },
  note: null,
  createdBy: 'admin-1',
  createdAt: NOW,
};

const COMMAND = {
  settingKey: SettingKey.AttendanceWeights,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  value: { practice: 3 },
  note: null,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const settings = {
    existsAtInstant: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(VERSION),
  };
  const audit = { append: vi.fn() };
  const useCase = new CreateSettingVersionUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    settings as never,
    audit,
  );
  return { useCase, settings, audit };
}

describe('CreateSettingVersionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends a setting version and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(result).toBe(VERSION);
    expect(harness.settings.insert.mock.calls[0]?.[1]).toMatchObject({
      settingKey: SettingKey.AttendanceWeights,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate effective instant', async () => {
    harness.settings.existsAtInstant.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(SettingVersionConflictError);
    expect(harness.settings.insert).not.toHaveBeenCalled();
  });
});
