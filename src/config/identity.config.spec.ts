import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_ACCOUNT_LOCKOUT_SECONDS,
  DEFAULT_FAILED_LOGIN_WINDOW_SECONDS,
  DEFAULT_INVITATION_TTL_SECONDS,
  DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
  DEFAULT_PASSWORD_RESET_TTL_SECONDS,
  DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
} from './config.constants';
import { identityConfig } from './identity.config';

const IDENTITY_ENV_KEYS = [
  'IDENTITY_REFRESH_TOKEN_TTL_SECONDS',
  'IDENTITY_INVITATION_TTL_SECONDS',
  'IDENTITY_PASSWORD_RESET_TTL_SECONDS',
  'IDENTITY_MAX_FAILED_LOGIN_ATTEMPTS',
  'IDENTITY_FAILED_LOGIN_WINDOW_SECONDS',
  'IDENTITY_ACCOUNT_LOCKOUT_SECONDS',
] as const;

const ORIGINAL: Record<string, string | undefined> = Object.fromEntries(
  IDENTITY_ENV_KEYS.map(key => [key, process.env[key]]),
);

function restore(): void {
  for (const key of IDENTITY_ENV_KEYS) {
    const original = ORIGINAL[key];
    if (original === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = original;
    }
  }
}

describe('identityConfig', () => {
  afterEach(() => {
    restore();
  });

  it('falls back to safe defaults when nothing is configured', () => {
    for (const key of IDENTITY_ENV_KEYS) {
      Reflect.deleteProperty(process.env, key);
    }

    expect(identityConfig()).toEqual({
      refreshTokenTtlSeconds: DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
      invitationTtlSeconds: DEFAULT_INVITATION_TTL_SECONDS,
      passwordResetTtlSeconds: DEFAULT_PASSWORD_RESET_TTL_SECONDS,
      maxFailedLoginAttempts: DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
      failedLoginWindowSeconds: DEFAULT_FAILED_LOGIN_WINDOW_SECONDS,
      accountLockoutSeconds: DEFAULT_ACCOUNT_LOCKOUT_SECONDS,
    });
  });

  it('parses configured overrides', () => {
    process.env['IDENTITY_REFRESH_TOKEN_TTL_SECONDS'] = '7200';
    process.env['IDENTITY_INVITATION_TTL_SECONDS'] = '3600';
    process.env['IDENTITY_PASSWORD_RESET_TTL_SECONDS'] = '600';
    process.env['IDENTITY_MAX_FAILED_LOGIN_ATTEMPTS'] = '3';
    process.env['IDENTITY_FAILED_LOGIN_WINDOW_SECONDS'] = '120';
    process.env['IDENTITY_ACCOUNT_LOCKOUT_SECONDS'] = '300';

    expect(identityConfig()).toEqual({
      refreshTokenTtlSeconds: 7200,
      invitationTtlSeconds: 3600,
      passwordResetTtlSeconds: 600,
      maxFailedLoginAttempts: 3,
      failedLoginWindowSeconds: 120,
      accountLockoutSeconds: 300,
    });
  });
});
