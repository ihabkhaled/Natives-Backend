import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactUnavailableError } from '../errors/contact-unavailable.error';
import type { ContactSubmission } from '../model/contact.types';
import { SendContactUseCase } from './send-contact.use-case';

const SUBMISSION: ContactSubmission = {
  email: 'visitor@example.test',
  subject: 'Question about tryouts',
  message: 'Hello, when do winter tryouts open?',
};

function build(enabled: boolean, toAddress: string | undefined) {
  const sender = { send: vi.fn().mockResolvedValue(undefined) };
  const config = {
    email: { enabled, toAddress, fromAddress: 'no-reply@natives.test' },
  };
  const useCase = new SendContactUseCase(sender, config as never);
  return { useCase, sender };
}

describe('SendContactUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(true, 'ops@natives.test');
  });

  it('relays the submission to the operator inbox and returns sent:true', async () => {
    const result = await harness.useCase.execute(SUBMISSION);

    expect(result).toEqual({ sent: true });
    expect(harness.sender.send).toHaveBeenCalledWith({
      to: 'ops@natives.test',
      subject: '[Ultimate Natives contact] Question about tryouts',
      body: 'From: visitor@example.test\n\nHello, when do winter tryouts open?',
      actionUrl: null,
      replyTo: 'visitor@example.test',
    });
  });

  it('is unavailable (503) when outbound email is disabled', async () => {
    const local = build(false, 'ops@natives.test');

    await expect(local.useCase.execute(SUBMISSION)).rejects.toBeInstanceOf(
      ContactUnavailableError,
    );
    expect(local.sender.send).not.toHaveBeenCalled();
  });

  it('is unavailable (503) when no operator inbox is configured', async () => {
    const local = build(true, undefined);

    await expect(local.useCase.execute(SUBMISSION)).rejects.toBeInstanceOf(
      ContactUnavailableError,
    );
    expect(local.sender.send).not.toHaveBeenCalled();
  });

  it('propagates a transport failure as an error (5xx to the caller)', async () => {
    harness.sender.send.mockRejectedValue(new Error('smtp down'));

    await expect(harness.useCase.execute(SUBMISSION)).rejects.toThrow(
      'smtp down',
    );
  });
});
