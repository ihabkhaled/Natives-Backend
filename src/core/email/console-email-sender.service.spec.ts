import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleEmailSenderService } from './console-email-sender.service';
import { CONSOLE_EMAIL_LOGGER_CONTEXT } from './email.constants';
import type { EmailMessage } from './email-sender.port';

const MESSAGE: EmailMessage = {
  to: 'invitee@example.test',
  subject: 'Your Ultimate Natives invitation',
  body: 'Open the link below:\nhttp://localhost:5173/accept-invitation?token=t',
  actionUrl: 'http://localhost:5173/accept-invitation?token=t',
};

function build() {
  const logger = {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { sender: new ConsoleEmailSenderService(logger as never), logger };
}

describe('ConsoleEmailSenderService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('names itself as the logging context so the transport is identifiable', () => {
    expect(harness.logger.setContext).toHaveBeenCalledWith(
      CONSOLE_EMAIL_LOGGER_CONTEXT,
    );
  });

  it('renders the whole message at info level', async () => {
    await harness.sender.send(MESSAGE);

    expect(harness.logger.info).toHaveBeenCalledTimes(1);
    expect(harness.logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        to: MESSAGE.to,
        subject: MESSAGE.subject,
        body: MESSAGE.body,
        actionUrl: MESSAGE.actionUrl,
      }),
    );
  });

  it('states that this is the console stand-in, not a real delivery', async () => {
    await harness.sender.send(MESSAGE);

    const context = harness.logger.info.mock.calls[0]?.[1] as {
      notice: string;
    };
    expect(context.notice).toContain('EMAIL_PROVIDER=console');
    expect(context.notice).toContain('manual delivery');
  });

  it('resolves without ever rejecting, so a send is never fatal', async () => {
    await expect(harness.sender.send(MESSAGE)).resolves.toBeUndefined();
  });
});
