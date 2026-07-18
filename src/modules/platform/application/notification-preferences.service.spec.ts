import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotificationCategory,
  NotificationChannel,
} from '../model/platform.enums';
import type { PreferenceUpdate } from '../model/platform.types';
import { NotificationPreferencesService } from './notification-preferences.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

function build() {
  const clock = { now: () => NOW, uptime: () => 0 };
  const preferences = {
    listForUser: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const service = new NotificationPreferencesService(
    unitOfWork as never,
    clock,
    preferences as never,
  );
  return { service, preferences };
}

const UPDATE: PreferenceUpdate = {
  category: NotificationCategory.Practice,
  channel: NotificationChannel.InApp,
  enabled: false,
};

describe('NotificationPreferencesService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reads the actor own preferences', async () => {
    const view = await harness.service.get(ACTOR);
    expect(view.items).toEqual([]);
    expect(harness.preferences.listForUser).toHaveBeenCalledWith(
      SCOPE,
      'user-1',
    );
  });

  it('upserts a toggle keyed on the actor and returns the fresh list', async () => {
    await harness.service.update(ACTOR, UPDATE);
    expect(harness.preferences.upsert).toHaveBeenCalledWith(
      SCOPE,
      'user-1',
      { userId: 'user-1', ...UPDATE },
      NOW,
    );
    expect(harness.preferences.listForUser).toHaveBeenCalledWith(
      SCOPE,
      'user-1',
    );
  });
});
