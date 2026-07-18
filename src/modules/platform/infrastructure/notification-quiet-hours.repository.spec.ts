import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuietHoursRow } from '../model/platform.rows';
import type { NotificationQuietHours } from '../model/platform.types';
import { NotificationQuietHoursRepository } from './notification-quiet-hours.repository';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

describe('NotificationQuietHoursRepository', () => {
  let repository: NotificationQuietHoursRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new NotificationQuietHoursRepository();
    scope = buildScope();
  });

  it('maps a user-owned quiet-hours row', async () => {
    const row: QuietHoursRow = {
      user_id: 'user-1',
      timezone: 'Africa/Cairo',
      starts_local: '22:00',
      ends_local: '07:00',
      urgent_cancellation_override: true,
    };
    scope.run.mockResolvedValueOnce([row]);
    await expect(
      repository.findForUser(scope as never, 'user-1'),
    ).resolves.toEqual({
      userId: 'user-1',
      timezone: 'Africa/Cairo',
      startsLocal: '22:00',
      endsLocal: '07:00',
      urgentCancellationOverride: true,
    });
  });

  it('returns null when a user has not configured quiet hours', async () => {
    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findForUser(scope as never, 'user-1'),
    ).resolves.toBeNull();
  });

  it('upserts by user id without accepting a caller-selected owner', async () => {
    const value: NotificationQuietHours = {
      userId: 'user-1',
      timezone: 'Africa/Cairo',
      startsLocal: '23:00',
      endsLocal: '06:30',
      urgentCancellationOverride: false,
    };
    scope.run.mockResolvedValueOnce([]);
    await repository.upsert(scope as never, value, NOW);
    expect(scope.run.mock.calls[0]?.[0]).toContain('ON CONFLICT ("user_id")');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'user-1',
      'Africa/Cairo',
      '23:00',
      '06:30',
      false,
      NOW.toISOString(),
    ]);
  });
});
