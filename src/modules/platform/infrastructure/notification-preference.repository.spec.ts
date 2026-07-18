import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotificationCategory,
  NotificationChannel,
} from '../model/platform.enums';
import type { PreferenceRow } from '../model/platform.rows';
import type { NotificationPreference } from '../model/platform.types';
import { NotificationPreferenceRepository } from './notification-preference.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

describe('NotificationPreferenceRepository', () => {
  let repo: NotificationPreferenceRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new NotificationPreferenceRepository();
    scope = buildScope();
  });

  it('defaults to enabled when no preference row exists', async () => {
    scope.run.mockResolvedValueOnce([]);
    expect(
      await repo.isEnabled(scope as never, 'user-1', 'practice', 'in_app'),
    ).toBe(true);
  });

  it('returns the stored enabled flag when a row exists', async () => {
    scope.run.mockResolvedValueOnce([{ enabled: false }]);
    expect(
      await repo.isEnabled(scope as never, 'user-1', 'practice', 'in_app'),
    ).toBe(false);
  });

  it('lists a user preferences', async () => {
    const row: PreferenceRow = {
      user_id: 'user-1',
      category: 'practice',
      channel: 'in_app',
      enabled: true,
    };
    scope.run.mockResolvedValueOnce([row]);
    const prefs = await repo.listForUser(scope as never, 'user-1');
    expect(prefs[0]?.category).toBe(NotificationCategory.Practice);
  });

  it('upserts a preference toggle', async () => {
    scope.run.mockResolvedValueOnce([]);
    const preference: NotificationPreference = {
      userId: 'user-1',
      category: NotificationCategory.Practice,
      channel: NotificationChannel.InApp,
      enabled: false,
    };
    await repo.upsert(scope as never, 'user-1', preference, NOW);
    expect(scope.run.mock.calls[0]?.[0]).toContain('ON CONFLICT');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'user-1',
      NotificationCategory.Practice,
      NotificationChannel.InApp,
      false,
      NOW.toISOString(),
    ]);
  });
});
