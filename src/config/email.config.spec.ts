import { EmailProvider } from '@shared/enums';
import { afterEach, describe, expect, it } from 'vitest';

import { emailConfig } from './email.config';

const KEYS = ['EMAIL_PROVIDER', 'EMAIL_FROM_ADDRESS', 'WEB_BASE_URL'] as const;

function clearEnv(): void {
  for (const key of KEYS) {
    Reflect.deleteProperty(process.env, key);
  }
}

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  clearEnv();
  for (const key of KEYS) {
    const value = values[key];
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
  return emailConfig();
}

afterEach(clearEnv);

describe('emailConfig', () => {
  it('defaults to the console transport so a fresh checkout still sends', () => {
    expect(withEnv({}).provider).toBe(EmailProvider.Console);
  });

  it('reads a known provider case-insensitively', () => {
    expect(withEnv({ EMAIL_PROVIDER: '  CONSOLE ' }).provider).toBe(
      EmailProvider.Console,
    );
  });

  it('falls back to the default rather than throwing on an unknown provider', () => {
    expect(withEnv({ EMAIL_PROVIDER: 'carrier-pigeon' }).provider).toBe(
      EmailProvider.Console,
    );
  });

  it('defaults the web origin to the local web app, not this api', () => {
    expect(withEnv({}).webBaseUrl).toBe('http://localhost:5173');
  });

  it('strips a trailing slash so links never double up separators', () => {
    expect(withEnv({ WEB_BASE_URL: 'https://app.test/' }).webBaseUrl).toBe(
      'https://app.test',
    );
  });

  it('ignores a blank override instead of building links against ""', () => {
    expect(withEnv({ WEB_BASE_URL: '   ' }).webBaseUrl).toBe(
      'http://localhost:5173',
    );
  });

  it('carries a from address', () => {
    expect(
      withEnv({ EMAIL_FROM_ADDRESS: 'team@natives.test' }).fromAddress,
    ).toBe('team@natives.test');
  });
});
