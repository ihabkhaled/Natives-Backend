import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VALID_BADGE_TIERS } from '../../../../test/fixtures/setting-values.fixture';
import { SettingVersionNotCancellableError } from '../errors/setting-version-not-cancellable.error';
import { SettingVersionNotFoundError } from '../errors/setting-version-not-found.error';
import { SETTING_VERSION_CANCELLED_EVENT } from '../model/teams.constants';
import { SettingKey } from '../model/teams.enums';
import type { SettingVersion } from '../model/teams.types';
import { CancelSettingVersionUseCase } from './cancel-setting-version.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const FUTURE_VERSION: SettingVersion = {
  id: 'sv-future',
  teamId: 'team-1',
  settingKey: SettingKey.BadgeTiers,
  effectiveFrom: new Date('2026-06-01T13:00:00.000Z'),
  value: VALID_BADGE_TIERS,
  note: 'scheduled tiers',
  createdBy: 'admin-1',
  createdAt: NOW,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const settings = {
    findById: vi.fn().mockResolvedValue(FUTURE_VERSION),
    deleteById: vi.fn().mockResolvedValue(true),
  };
  const audit = { append: vi.fn() };
  const useCase = new CancelSettingVersionUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    settings as never,
    audit,
  );
  return { useCase, settings, audit };
}

describe('CancelSettingVersionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('deletes a future-effective version and audits the cancellation', async () => {
    await harness.useCase.execute(ACTOR, 'team-1', 'sv-future');
    expect(harness.settings.deleteById).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'sv-future',
    );
    expect(harness.audit.append.mock.calls[0]?.[1]).toMatchObject({
      eventType: SETTING_VERSION_CANCELLED_EVENT,
      actorUserId: 'admin-1',
      context: {
        teamId: 'team-1',
        settingKey: SettingKey.BadgeTiers,
        settingVersionId: 'sv-future',
        effectiveFrom: '2026-06-01T13:00:00.000Z',
      },
    });
  });

  it('refuses to cancel a version already in effect (409)', async () => {
    harness.settings.findById.mockResolvedValue({
      ...FUTURE_VERSION,
      effectiveFrom: new Date('2026-06-01T11:00:00.000Z'),
    });
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'sv-future'),
    ).rejects.toBeInstanceOf(SettingVersionNotCancellableError);
    expect(harness.settings.deleteById).not.toHaveBeenCalled();
    expect(harness.audit.append).not.toHaveBeenCalled();
  });

  it('refuses to cancel a version effective exactly now (boundary)', async () => {
    harness.settings.findById.mockResolvedValue({
      ...FUTURE_VERSION,
      effectiveFrom: NOW,
    });
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'sv-future'),
    ).rejects.toBeInstanceOf(SettingVersionNotCancellableError);
  });

  it('reports a missing version as not found (404)', async () => {
    harness.settings.findById.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'missing'),
    ).rejects.toBeInstanceOf(SettingVersionNotFoundError);
    expect(harness.settings.deleteById).not.toHaveBeenCalled();
  });
});
