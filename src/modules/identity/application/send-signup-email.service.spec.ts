import { AccountState } from '@modules/identity/model/identity.enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SignupRequestSummary } from '../model/identity.types';
import { SendSignupEmailService } from './send-signup-email.service';

const SUMMARY: SignupRequestSummary = {
  id: 'signup-1',
  email: 'applicant@example.test',
  displayName: 'Sam',
  state: AccountState.Pending,
  requestedAt: new Date('2026-06-01T12:00:00.000Z'),
};

function build(toAddress: string | undefined) {
  const sender = { send: vi.fn().mockResolvedValue(undefined) };
  const logger = { setContext: vi.fn(), error: vi.fn() };
  const config = {
    email: { webBaseUrl: 'https://app.natives.test', toAddress },
  };
  const service = new SendSignupEmailService(
    sender,
    config as never,
    logger as never,
  );
  return { service, sender, logger };
}

describe('SendSignupEmailService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build('ops@natives.test');
  });

  it('emails the applicant and the admin inbox on a new signup', async () => {
    await harness.service.sendPendingNotifications(SUMMARY);

    const recipients = harness.sender.send.mock.calls.map(
      call => (call[0] as { to: string }).to,
    );
    expect(recipients).toEqual(['applicant@example.test', 'ops@natives.test']);
  });

  it('skips the admin notification when no operator inbox is configured', async () => {
    const local = build(undefined);
    await local.service.sendPendingNotifications(SUMMARY);

    expect(local.sender.send).toHaveBeenCalledTimes(1);
    expect(local.sender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'applicant@example.test' }),
    );
  });

  it('emails the applicant on approval', async () => {
    await harness.service.sendApproved(SUMMARY);

    expect(harness.sender.send).toHaveBeenCalledTimes(1);
    expect(harness.sender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'applicant@example.test' }),
    );
  });

  it('never lets a transport failure escape (best-effort delivery)', async () => {
    harness.sender.send.mockRejectedValue(new Error('smtp down'));

    await expect(
      harness.service.sendRejected(SUMMARY),
    ).resolves.toBeUndefined();
    expect(harness.logger.error).toHaveBeenCalled();
  });
});
