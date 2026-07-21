import { registerAs } from '@nestjs/config';
import { EMAIL_PROVIDER_VALUES, type EmailProvider } from '@shared/enums';

import {
  DEFAULT_EMAIL_PROVIDER,
  DEFAULT_WEB_BASE_URL,
  EMAIL_CONFIG_NAMESPACE,
  EMAIL_FROM_ADDRESS_DEFAULT,
} from './config.constants';
import type { EmailConfig } from './config.types';

/**
 * Typed outbound-email configuration: the only place email env vars are read.
 *
 * `EMAIL_PROVIDER` selects the adapter bound to `EmailSenderPort` and defaults
 * to the console transport, so a fresh checkout sends invitations without any
 * credential (OD-002). An unrecognised value falls back to the default rather
 * than throwing: an operator typo must not silently stop invitations from being
 * delivered somewhere observable.
 */
export const emailConfig = registerAs(
  EMAIL_CONFIG_NAMESPACE,
  (): EmailConfig => ({
    provider: parseProvider(process.env['EMAIL_PROVIDER']),
    fromAddress: parseText(
      process.env['EMAIL_FROM_ADDRESS'],
      EMAIL_FROM_ADDRESS_DEFAULT,
    ),
    webBaseUrl: stripTrailingSlash(
      parseText(process.env['WEB_BASE_URL'], DEFAULT_WEB_BASE_URL),
    ),
  }),
);

function parseProvider(raw: string | undefined): EmailProvider {
  const normalized = raw?.trim().toLowerCase() ?? '';
  return (
    EMAIL_PROVIDER_VALUES.find(
      provider => (provider as string) === normalized,
    ) ?? DEFAULT_EMAIL_PROVIDER
  );
}

function parseText(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : fallback;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
