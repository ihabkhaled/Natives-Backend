import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationStatus } from '../model/identity.enums';
import type { InvitationDelivery } from '../model/identity.types';
import { SendInvitationEmailService } from './send-invitation-email.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const DELIVERY: InvitationDelivery = {
  id: 'inv-1',
  email: 'invitee@example.test',
  role: 'admin' as InvitationDelivery['role'],
  status: InvitationStatus.Pending,
  expiresAt: new Date('2026-06-08T12:00:00.000Z'),
  createdAt: NOW,
  token: 'raw-token-value',
};

function build() {
  const sender = { send: vi.fn().mockResolvedValue(undefined) };
  const config = { email: { webBaseUrl: 'http://localhost:5173' } };
  const logger = {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const service = new SendInvitationEmailService(
    sender,
    config as never,
    logger as never,
  );
  return { service, sender, logger };
}

describe('SendInvitationEmailService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('sends a message addressed to the invitee', async () => {
    await harness.service.send(DELIVERY);

    expect(harness.sender.send).toHaveBeenCalledTimes(1);
    expect(harness.sender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: DELIVERY.email }),
    );
  });

  it('builds the accept link from the configured web origin and the token', async () => {
    await harness.service.send(DELIVERY);

    expect(harness.sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        actionUrl:
          'http://localhost:5173/accept-invitation?token=raw-token-value',
      }),
    );
  });

  it('swallows a transport failure so a committed invitation still succeeds', async () => {
    harness.sender.send.mockRejectedValue(new Error('smtp unreachable'));

    await expect(harness.service.send(DELIVERY)).resolves.toBeUndefined();
  });

  it('records a transport failure instead of losing it silently', async () => {
    const failure = new Error('smtp unreachable');
    harness.sender.send.mockRejectedValue(failure);

    await harness.service.send(DELIVERY);

    expect(harness.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('manual delivery'),
      expect.objectContaining({ invitationId: DELIVERY.id, error: failure }),
    );
  });
});
