import { NodeEnv } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  areCorsOriginsValid,
  isDatabasePoolValid,
  isProductionDatabaseSslValid,
  isProductionJwtSecretValid,
  isSmtpConfigValid,
} from './config-validation.helpers';

const SMTP_CREDS = {
  from: 'no-reply@natives.test',
  to: 'ops@natives.test',
  host: 'smtp.test',
  user: 'u',
  pass: 'p',
};

const STRONG_SECRET = 'aB3cD4eF5gH6iJ7kL8mN9pQ0rS1tU2vW3xY4zA5bC6dE';

describe('config validation helpers', () => {
  it('validates only exact HTTP and HTTPS origins', () => {
    expect(
      areCorsOriginsValid('https://one.example,http://localhost:3000'),
    ).toBe(true);
    expect(areCorsOriginsValid('ftp://one.example')).toBe(false);
    expect(areCorsOriginsValid('https://one.example/path')).toBe(false);
  });

  it('does not apply production secret policy outside production', () => {
    expect(isProductionJwtSecretValid(NodeEnv.Development, undefined)).toBe(
      true,
    );
  });

  it('rejects missing, short, placeholder, and low-entropy production secrets', () => {
    expect(isProductionJwtSecretValid(NodeEnv.Production, undefined)).toBe(
      false,
    );
    expect(isProductionJwtSecretValid(NodeEnv.Production, 'short')).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'change-me-min-32-characters-long-secret',
      ),
    ).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ),
    ).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'secretABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      ),
    ).toBe(false);
    expect(
      isProductionJwtSecretValid(
        NodeEnv.Production,
        'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG',
      ),
    ).toBe(false);
  });

  it('accepts a strong production secret', () => {
    expect(isProductionJwtSecretValid(NodeEnv.Production, STRONG_SECRET)).toBe(
      true,
    );
  });

  it('accepts pool bounds where min <= max and defaults when unset', () => {
    expect(isDatabasePoolValid(2, 10)).toBe(true);
    expect(isDatabasePoolValid(5, 5)).toBe(true);
    expect(isDatabasePoolValid(undefined, undefined)).toBe(true);
    expect(isDatabasePoolValid(undefined, 1)).toBe(false);
  });

  it('rejects pool bounds where min > max', () => {
    expect(isDatabasePoolValid(11, 10)).toBe(false);
  });

  it('requires SSL only in production', () => {
    expect(isProductionDatabaseSslValid(NodeEnv.Development, undefined)).toBe(
      true,
    );
    expect(isProductionDatabaseSslValid(NodeEnv.Test, 'false')).toBe(true);
    expect(isProductionDatabaseSslValid(NodeEnv.Production, 'true')).toBe(true);
    expect(isProductionDatabaseSslValid(NodeEnv.Production, 'false')).toBe(
      false,
    );
    expect(isProductionDatabaseSslValid(NodeEnv.Production, undefined)).toBe(
      false,
    );
  });

  it('requires the full email config only when smtp is selected and enabled', () => {
    expect(
      isSmtpConfigValid({ provider: 'smtp', enabled: 'true', ...SMTP_CREDS }),
    ).toBe(true);
    expect(
      isSmtpConfigValid({
        provider: 'SMTP',
        enabled: 'true',
        ...SMTP_CREDS,
        host: undefined,
      }),
    ).toBe(false);
    expect(
      isSmtpConfigValid({
        provider: 'smtp',
        enabled: 'true',
        ...SMTP_CREDS,
        user: '  ',
      }),
    ).toBe(false);
  });

  it('also requires the from and to addresses for real delivery', () => {
    expect(
      isSmtpConfigValid({
        provider: 'smtp',
        enabled: 'true',
        ...SMTP_CREDS,
        from: undefined,
      }),
    ).toBe(false);
    expect(
      isSmtpConfigValid({
        provider: 'smtp',
        enabled: 'true',
        ...SMTP_CREDS,
        to: undefined,
      }),
    ).toBe(false);
  });

  it('does not require the email config for console or disabled email', () => {
    const empty = {
      from: undefined,
      to: undefined,
      host: undefined,
      user: undefined,
      pass: undefined,
    };
    expect(
      isSmtpConfigValid({ provider: 'console', enabled: 'true', ...empty }),
    ).toBe(true);
    expect(
      isSmtpConfigValid({ provider: 'smtp', enabled: 'false', ...empty }),
    ).toBe(true);
  });
});
