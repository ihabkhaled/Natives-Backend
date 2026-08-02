import type { AppConfigService } from '@config/app-config.service';
import type { AppLogger } from '@core/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConsoleEmailSenderService } from './console-email-sender.service';
import { SMTP_THROTTLE_EXCEEDED_MESSAGE } from './email.constants';
import type { EmailMessage } from './email-sender.port';
import { EmailThrottledError } from './email-throttled.error';
import type { MailTransportPort } from './mail-transport.port';
import { SmtpEmailSenderService } from './smtp-email-sender.service';

const MESSAGE: EmailMessage = {
  to: 'invitee@example.test',
  subject: 'Your Ultimate Natives invitation',
  body: 'Open the link',
  actionUrl: null,
};

function build(options: {
  enabled: boolean;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}) {
  const transport = {
    sendMail: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailTransportPort;
  const consoleSender = {
    send: vi.fn().mockResolvedValue(undefined),
  } as unknown as ConsoleEmailSenderService;
  const logger = { setContext: vi.fn(), warn: vi.fn() } as unknown as AppLogger;
  const clockState = { ms: 0 };
  const clock = {
    now: () => new Date(clockState.ms),
    uptime: () => 0,
  };
  const config = {
    email: {
      enabled: options.enabled,
      fromAddress: 'no-reply@natives.test',
      rateLimitMax: options.rateLimitMax ?? 100,
      rateLimitWindowMs: options.rateLimitWindowMs ?? 60_000,
    },
  } as unknown as AppConfigService;
  const service = new SmtpEmailSenderService(
    transport,
    config,
    consoleSender,
    logger,
    clock,
  );
  return { service, transport, consoleSender, logger, clockState };
}

describe('SmtpEmailSenderService', () => {
  let harness: ReturnType<typeof build>;

  describe('when the master switch is off', () => {
    beforeEach(() => {
      harness = build({ enabled: false });
    });

    it('delegates to the console stand-in', async () => {
      await harness.service.send(MESSAGE);
      expect(harness.consoleSender.send).toHaveBeenCalledWith(MESSAGE);
    });

    it('never touches the smtp transport', async () => {
      await harness.service.send(MESSAGE);
      expect(harness.transport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('when enabled', () => {
    beforeEach(() => {
      harness = build({ enabled: true });
    });

    it('delivers through the smtp transport with the configured from address', async () => {
      await harness.service.send(MESSAGE);
      expect(harness.transport.sendMail).toHaveBeenCalledWith({
        from: 'no-reply@natives.test',
        to: MESSAGE.to,
        subject: MESSAGE.subject,
        text: MESSAGE.body,
      });
    });

    it('forwards a Reply-To when the message carries one', async () => {
      await harness.service.send({
        ...MESSAGE,
        replyTo: 'visitor@example.test',
      });
      expect(harness.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'visitor@example.test' }),
      );
    });
  });

  describe('throttling', () => {
    beforeEach(() => {
      harness = build({
        enabled: true,
        rateLimitMax: 2,
        rateLimitWindowMs: 60_000,
      });
    });

    it('rejects once the window budget is spent, so a caller never reports "sent" for a dropped email', async () => {
      await harness.service.send(MESSAGE);
      await harness.service.send(MESSAGE);

      await expect(harness.service.send(MESSAGE)).rejects.toThrow(
        EmailThrottledError,
      );

      expect(harness.transport.sendMail).toHaveBeenCalledTimes(2);
      expect(harness.logger.warn).toHaveBeenCalledWith(
        SMTP_THROTTLE_EXCEEDED_MESSAGE,
        { to: MESSAGE.to },
      );
    });

    it('replenishes the budget after the window slides past', async () => {
      await harness.service.send(MESSAGE);
      await harness.service.send(MESSAGE);
      harness.clockState.ms += 60_001;
      await harness.service.send(MESSAGE);

      expect(harness.transport.sendMail).toHaveBeenCalledTimes(3);
    });
  });
});
