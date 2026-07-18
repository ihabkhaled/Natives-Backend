import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeliveryStatus, NotificationChannel } from '../model/platform.enums';
import type { NewDelivery } from '../model/platform.types';
import { NotificationDeliveryRepository } from './notification-delivery.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

describe('NotificationDeliveryRepository', () => {
  let repo: NotificationDeliveryRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new NotificationDeliveryRepository();
    scope = buildScope();
  });

  it('inserts a delivery attempt with its status and error', async () => {
    scope.run.mockResolvedValueOnce([]);
    const delivery: NewDelivery = {
      id: 'd-1',
      notificationId: 'n-1',
      channel: NotificationChannel.InApp,
      status: DeliveryStatus.Sent,
      lastError: null,
      now: NOW,
    };
    await repo.insert(scope as never, delivery);
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'd-1',
      'n-1',
      NotificationChannel.InApp,
      DeliveryStatus.Sent,
      null,
      NOW.toISOString(),
    ]);
  });
});
