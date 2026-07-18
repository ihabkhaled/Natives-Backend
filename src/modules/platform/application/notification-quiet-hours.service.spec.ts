import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationQuietHoursError } from '../errors/notification-quiet-hours.error';
import type { NotificationQuietHours } from '../model/platform.types';
import { NotificationQuietHoursService } from './notification-quiet-hours.service';

const SCOPE = {} as never;
const NOW = new Date('2026-07-18T12:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };
const STORED: NotificationQuietHours = {
  userId: 'user-1',
  timezone: 'Africa/Cairo',
  startsLocal: '22:00',
  endsLocal: '07:00',
  urgentCancellationOverride: true,
};

function build(stored: NotificationQuietHours | null = STORED) {
  const repository = {
    findForUser: vi.fn().mockResolvedValue(stored),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (scope: never) => unknown) =>
      operation(SCOPE),
    ),
  };
  const service = new NotificationQuietHoursService(
    unitOfWork as never,
    { now: () => NOW, uptime: () => 0 },
    repository as never,
  );
  return { service, repository };
}

describe('NotificationQuietHoursService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns safe defaults when no row exists', async () => {
    const empty = build(null);
    await expect(empty.service.get(ACTOR)).resolves.toMatchObject({
      userId: 'user-1',
      timezone: 'Africa/Cairo',
      startsLocal: '22:00',
      endsLocal: '07:00',
      urgentCancellationOverride: true,
    });
  });

  it('updates only the authenticated owner and returns the fresh value', async () => {
    const update = {
      timezone: 'Asia/Beirut',
      startsLocal: '23:00',
      endsLocal: '06:00',
      urgentCancellationOverride: false,
    };
    harness.repository.findForUser.mockResolvedValueOnce({
      userId: 'user-1',
      ...update,
    });
    await expect(harness.service.update(ACTOR, update)).resolves.toEqual({
      userId: 'user-1',
      ...update,
    });
    expect(harness.repository.upsert).toHaveBeenCalledWith(
      SCOPE,
      { userId: 'user-1', ...update },
      NOW,
    );
  });

  it('rejects an unknown IANA timezone before persistence', async () => {
    await expect(
      harness.service.update(ACTOR, {
        ...STORED,
        timezone: 'Not/A_Timezone',
      }),
    ).rejects.toBeInstanceOf(NotificationQuietHoursError);
    expect(harness.repository.upsert).not.toHaveBeenCalled();
  });

  it('returns the submitted value when the upsert read-back is absent', async () => {
    harness.repository.findForUser.mockResolvedValueOnce(null);
    const update = {
      timezone: 'UTC',
      startsLocal: '21:00',
      endsLocal: '05:00',
      urgentCancellationOverride: true,
    };
    await expect(harness.service.update(ACTOR, update)).resolves.toEqual({
      userId: 'user-1',
      ...update,
    });
  });

  it('reports whether a delivery is allowed for the owner', async () => {
    await expect(
      harness.service.isAllowed(
        'user-1',
        new Date('2026-07-18T21:30:00.000Z'),
        false,
      ),
    ).resolves.toBe(false);
    await expect(
      harness.service.isAllowed(
        'user-1',
        new Date('2026-07-18T21:30:00.000Z'),
        true,
      ),
    ).resolves.toBe(true);
  });
});
