import { afterEach, describe, expect, it } from 'vitest';

import { securityConfig } from './security.config';

const ORIGINAL_JWT_SECRET = process.env['JWT_SECRET'];
const ORIGINAL_RATE_LIMIT_MAX = process.env['RATE_LIMIT_MAX'];

function restoreJwtSecret(): void {
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env['JWT_SECRET'];
    return;
  }
  process.env['JWT_SECRET'] = ORIGINAL_JWT_SECRET;
}

function restoreRateLimitMax(): void {
  if (ORIGINAL_RATE_LIMIT_MAX === undefined) {
    delete process.env['RATE_LIMIT_MAX'];
    return;
  }
  process.env['RATE_LIMIT_MAX'] = ORIGINAL_RATE_LIMIT_MAX;
}

describe('securityConfig', () => {
  afterEach(() => {
    restoreJwtSecret();
    restoreRateLimitMax();
  });

  it('returns parsed security configuration', () => {
    process.env['JWT_SECRET'] = 'configured-secret-value-with-32-characters';
    process.env['RATE_LIMIT_MAX'] = '25';

    expect(securityConfig()).toMatchObject({
      jwtSecret: 'configured-secret-value-with-32-characters',
      rateLimitMax: 25,
    });
  });

  it('rejects a missing JWT secret even if startup validation is bypassed', () => {
    delete process.env['JWT_SECRET'];

    expect(() => securityConfig()).toThrow(
      'Required configuration value is missing: JWT_SECRET',
    );
  });
});
