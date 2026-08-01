import { registerAs } from '@nestjs/config';
import { EMAIL_PROVIDER_VALUES, type EmailProvider } from '@shared/enums';

import {
  DEFAULT_EMAIL_ENABLED,
  DEFAULT_EMAIL_PROVIDER,
  DEFAULT_EMAIL_RATE_LIMIT_MAX,
  DEFAULT_EMAIL_RATE_LIMIT_WINDOW_MS,
  DEFAULT_SMTP_PORT,
  DEFAULT_SMTP_SECURE,
  DEFAULT_WEB_BASE_URL,
  EMAIL_CONFIG_NAMESPACE,
  EMAIL_FROM_ADDRESS_DEFAULT,
} from './config.constants';
import type { EmailConfig, SmtpTransportConfig } from './config.types';
import { parseBoolean, parseInteger } from './config.utils';

/**
 * Typed outbound-email configuration: the only place email env vars are read.
 *
 * `EMAIL_PROVIDER` selects the adapter bound to `EmailSenderPort` and defaults
 * to the console transport, so a fresh checkout sends invitations without any
 * credential (OD-002). An unrecognised value falls back to the default rather
 * than throwing: an operator typo must not silently stop invitations from being
 * delivered somewhere observable. `EMAIL_ENABLED` is the master switch — when
 * false the console stand-in stays bound regardless of provider.
 */
export const emailConfig = registerAs(
  EMAIL_CONFIG_NAMESPACE,
  (): EmailConfig => ({
    provider: parseProvider(process.env['EMAIL_PROVIDER']),
    enabled: parseBoolean(process.env['EMAIL_ENABLED'], DEFAULT_EMAIL_ENABLED),
    fromAddress: parseText(
      process.env['EMAIL_FROM'] ?? process.env['EMAIL_FROM_ADDRESS'],
      EMAIL_FROM_ADDRESS_DEFAULT,
    ),
    toAddress: parseOptionalText(process.env['EMAIL_TO']),
    webBaseUrl: stripTrailingSlash(
      parseText(process.env['WEB_BASE_URL'], DEFAULT_WEB_BASE_URL),
    ),
    smtp: parseSmtp(),
    rateLimitMax: parseInteger(
      process.env['RATE_LIMIT_MAX'],
      DEFAULT_EMAIL_RATE_LIMIT_MAX,
    ),
    rateLimitWindowMs: parseInteger(
      process.env['RATE_LIMIT_WINDOW_MS'],
      DEFAULT_EMAIL_RATE_LIMIT_WINDOW_MS,
    ),
  }),
);

function parseSmtp(): SmtpTransportConfig {
  return {
    host: parseOptionalText(process.env['SMTP_HOST']),
    port: parseInteger(process.env['SMTP_PORT'], DEFAULT_SMTP_PORT),
    secure: parseBoolean(process.env['SMTP_SECURE'], DEFAULT_SMTP_SECURE),
    user: parseOptionalText(process.env['SMTP_USER']),
    pass: parseOptionalText(process.env['SMTP_PASS']),
  };
}

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

function parseOptionalText(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
