import type { AppConfigService } from '@config/app-config.service';
import type { AppLogger } from '@core/logger';
import { EmailProvider } from '@shared/enums';
import { describe, expect, it, vi } from 'vitest';

import type { ConsoleEmailSenderService } from './console-email-sender.service';
import { selectSender } from './email.module';
import { SmtpEmailSenderService } from './smtp-email-sender.service';

const CONSOLE_SENDER = {
  send: vi.fn().mockResolvedValue(undefined),
} as unknown as ConsoleEmailSenderService;

const LOGGER = { setContext: vi.fn(), warn: vi.fn() } as unknown as AppLogger;

const CLOCK = { now: () => new Date(0), uptime: () => 0 };

function configFor(
  provider: EmailProvider,
  enabled: boolean,
): AppConfigService {
  return {
    email: {
      provider,
      enabled,
      fromAddress: 'no-reply@natives.test',
      smtp: {
        host: 'smtp.test',
        port: 587,
        secure: false,
        user: 'user',
        pass: 'pass',
      },
      rateLimitMax: 10,
      rateLimitWindowMs: 1000,
    },
  } as unknown as AppConfigService;
}

describe('selectSender', () => {
  it('binds the console adapter for the console provider', () => {
    expect(
      selectSender(
        configFor(EmailProvider.Console, true),
        CONSOLE_SENDER,
        LOGGER,
        CLOCK,
      ),
    ).toBe(CONSOLE_SENDER);
  });

  it('binds the smtp sender when smtp is selected and enabled', () => {
    expect(
      selectSender(
        configFor(EmailProvider.Smtp, true),
        CONSOLE_SENDER,
        LOGGER,
        CLOCK,
      ),
    ).toBeInstanceOf(SmtpEmailSenderService);
  });

  it('falls back to the console adapter when smtp is selected but disabled', () => {
    expect(
      selectSender(
        configFor(EmailProvider.Smtp, false),
        CONSOLE_SENDER,
        LOGGER,
        CLOCK,
      ),
    ).toBe(CONSOLE_SENDER);
  });
});
