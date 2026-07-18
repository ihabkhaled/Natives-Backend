import { afterEach, describe, expect, it } from 'vitest';

import { loadSeedAdminConfig } from './seed-admin.config';

const SEED_KEYS = [
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  'SEED_ADMIN_DISPLAY_NAME',
] as const;

function clearSeedEnv(): void {
  for (const key of SEED_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }
}

describe('loadSeedAdminConfig', () => {
  afterEach(() => {
    clearSeedEnv();
  });

  it('uses synthetic identity defaults but requires the password at runtime', () => {
    clearSeedEnv();
    process.env['SEED_ADMIN_PASSWORD'] = 'runtime-only-password';

    expect(loadSeedAdminConfig()).toEqual({
      email: 'admin@ultimatenatives.local',
      password: 'runtime-only-password',
      displayName: 'Ultimate Natives Admin',
    });
  });

  it.each([undefined, '', '   ', 'short-value'])(
    'rejects a missing, blank, or weak runtime password (%s)',
    candidate => {
      clearSeedEnv();
      if (candidate !== undefined) {
        process.env['SEED_ADMIN_PASSWORD'] = candidate;
      }

      expect(() => loadSeedAdminConfig()).toThrow(
        'SEED_ADMIN_PASSWORD must be provided at runtime',
      );
    },
  );

  it('rejects a password that exceeds the bcrypt byte limit', () => {
    clearSeedEnv();
    process.env['SEED_ADMIN_PASSWORD'] = 'a'.repeat(73);

    expect(() => loadSeedAdminConfig()).toThrow(
      'SEED_ADMIN_PASSWORD must not exceed 72 UTF-8 bytes',
    );
  });

  it('trims and returns explicit local seed identity values', () => {
    clearSeedEnv();
    process.env['SEED_ADMIN_EMAIL'] = ' admin@example.test ';
    process.env['SEED_ADMIN_PASSWORD'] = 'runtime-only-password';
    process.env['SEED_ADMIN_DISPLAY_NAME'] = ' Local Administrator ';

    expect(loadSeedAdminConfig()).toEqual({
      email: 'admin@example.test',
      password: 'runtime-only-password',
      displayName: 'Local Administrator',
    });
  });

  it('rejects invalid email and blank display-name values', () => {
    clearSeedEnv();
    process.env['SEED_ADMIN_PASSWORD'] = 'runtime-only-password';
    process.env['SEED_ADMIN_EMAIL'] = 'not-an-email';
    expect(() => loadSeedAdminConfig()).toThrow(
      'SEED_ADMIN_EMAIL must be a valid email address',
    );

    process.env['SEED_ADMIN_EMAIL'] = 'admin@example.test';
    process.env['SEED_ADMIN_DISPLAY_NAME'] = '   ';
    expect(() => loadSeedAdminConfig()).toThrow(
      'SEED_ADMIN_DISPLAY_NAME must not be blank',
    );
  });
});
