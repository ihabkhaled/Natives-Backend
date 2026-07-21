import { EmailProvider } from '@shared/enums';
import { describe, expect, it, vi } from 'vitest';

import type { ConsoleEmailSenderService } from './console-email-sender.service';
import { selectSender } from './email.module';

const CONSOLE_SENDER = {
  send: vi.fn().mockResolvedValue(undefined),
} as unknown as ConsoleEmailSenderService;

function configFor(provider: EmailProvider) {
  return { email: { provider } } as never;
}

describe('selectSender', () => {
  it('binds the console adapter for the console provider', () => {
    expect(selectSender(configFor(EmailProvider.Console), CONSOLE_SENDER)).toBe(
      CONSOLE_SENDER,
    );
  });

  it('falls back to the console adapter for an unmodelled provider', () => {
    expect(
      selectSender(configFor('smtp' as EmailProvider), CONSOLE_SENDER),
    ).toBe(CONSOLE_SENDER);
  });
});
