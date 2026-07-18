import { registerAs } from '@nestjs/config';

import {
  DEFAULT_ACCOUNT_LOCKOUT_SECONDS,
  DEFAULT_FAILED_LOGIN_WINDOW_SECONDS,
  DEFAULT_INVITATION_TTL_SECONDS,
  DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
  DEFAULT_PASSWORD_RESET_TTL_SECONDS,
  DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  IDENTITY_CONFIG_NAMESPACE,
} from './config.constants';
import type { IdentityConfig } from './config.types';
import { parseInteger } from './config.utils';

/**
 * Typed identity configuration: session/token lifetimes and login-throttling
 * bounds. The only place identity env vars are read. All TTLs are seconds and
 * turned into UTC instants at the edge via the ClockPort. Bounds are validated
 * fail-fast in environment-variables.dto so an invalid value never reaches here.
 */
export const identityConfig = registerAs(
  IDENTITY_CONFIG_NAMESPACE,
  (): IdentityConfig => ({
    refreshTokenTtlSeconds: parseInteger(
      process.env['IDENTITY_REFRESH_TOKEN_TTL_SECONDS'],
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    ),
    invitationTtlSeconds: parseInteger(
      process.env['IDENTITY_INVITATION_TTL_SECONDS'],
      DEFAULT_INVITATION_TTL_SECONDS,
    ),
    passwordResetTtlSeconds: parseInteger(
      process.env['IDENTITY_PASSWORD_RESET_TTL_SECONDS'],
      DEFAULT_PASSWORD_RESET_TTL_SECONDS,
    ),
    maxFailedLoginAttempts: parseInteger(
      process.env['IDENTITY_MAX_FAILED_LOGIN_ATTEMPTS'],
      DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
    ),
    failedLoginWindowSeconds: parseInteger(
      process.env['IDENTITY_FAILED_LOGIN_WINDOW_SECONDS'],
      DEFAULT_FAILED_LOGIN_WINDOW_SECONDS,
    ),
    accountLockoutSeconds: parseInteger(
      process.env['IDENTITY_ACCOUNT_LOCKOUT_SECONDS'],
      DEFAULT_ACCOUNT_LOCKOUT_SECONDS,
    ),
  }),
);
