import { EmailProvider } from '@shared/enums';
import { afterEach, describe, expect, it } from 'vitest';

import { emailConfig } from './email.config';

const KEYS = [
  'EMAIL_PROVIDER',
  'EMAIL_ENABLED',
  'EMAIL_FROM',
  'EMAIL_FROM_ADDRESS',
  'EMAIL_TO',
  'WEB_BASE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'RATE_LIMIT_MAX',
  'RATE_LIMIT_WINDOW_MS',
] as const;

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

  it('reads the smtp provider case-insensitively', () => {
    expect(withEnv({ EMAIL_PROVIDER: '  SMTP ' }).provider).toBe(
      EmailProvider.Smtp,
    );
  });

  it('falls back to the default rather than throwing on an unknown provider', () => {
    expect(withEnv({ EMAIL_PROVIDER: 'carrier-pigeon' }).provider).toBe(
      EmailProvider.Console,
    );
  });

  it('keeps outbound delivery disabled by default', () => {
    expect(withEnv({}).enabled).toBe(false);
  });

  it('honours the master enable switch', () => {
    expect(withEnv({ EMAIL_ENABLED: 'true' }).enabled).toBe(true);
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

  it('prefers EMAIL_FROM over the legacy EMAIL_FROM_ADDRESS', () => {
    expect(
      withEnv({
        EMAIL_FROM: 'from@natives.test',
        EMAIL_FROM_ADDRESS: 'legacy@natives.test',
      }).fromAddress,
    ).toBe('from@natives.test');
  });

  it('still reads the legacy EMAIL_FROM_ADDRESS when EMAIL_FROM is absent', () => {
    expect(
      withEnv({ EMAIL_FROM_ADDRESS: 'legacy@natives.test' }).fromAddress,
    ).toBe('legacy@natives.test');
  });

  it('carries the operator notification inbox', () => {
    expect(withEnv({ EMAIL_TO: 'ops@natives.test' }).toAddress).toBe(
      'ops@natives.test',
    );
  });

  it('leaves the operator inbox undefined when unset', () => {
    expect(withEnv({}).toAddress).toBeUndefined();
  });

  it('reads the smtp transport credentials', () => {
    const smtp = withEnv({
      SMTP_HOST: 'smtp-relay.brevo.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'user@smtp',
      SMTP_PASS: 'secret',
    }).smtp;

    expect(smtp).toEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      user: 'user@smtp',
      pass: 'secret',
    });
  });

  it('defaults the smtp port and secure flag', () => {
    const smtp = withEnv({}).smtp;
    expect(smtp.port).toBe(587);
    expect(smtp.secure).toBe(false);
    expect(smtp.host).toBeUndefined();
  });

  it('reads the send-throttle bounds', () => {
    const config = withEnv({
      RATE_LIMIT_MAX: '3',
      RATE_LIMIT_WINDOW_MS: '3600000',
    });
    expect(config.rateLimitMax).toBe(3);
    expect(config.rateLimitWindowMs).toBe(3_600_000);
  });
});
