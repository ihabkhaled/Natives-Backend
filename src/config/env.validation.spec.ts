import { NodeEnv } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validation';

const VALID_JWT_SECRET = 'aB3cD4eF5gH6iJ7kL8mN9pQ0rS1tU2vW3xY4zA5bC6dE';

describe('validateEnv', () => {
  it('accepts defaults in development', () => {
    const raw = {
      NODE_ENV: NodeEnv.Development,
      JWT_SECRET: VALID_JWT_SECRET,
    };

    expect(validateEnv(raw)).toBe(raw);
  });

  it('accepts every consumed environment value when valid', () => {
    const raw = {
      NODE_ENV: NodeEnv.Test,
      PORT: '3001',
      APP_NAME: 'iron-nest-test',
      GLOBAL_PREFIX: 'api',
      ENABLE_SWAGGER: 'false',
      LOG_LEVEL: 'debug',
      CORS_ORIGIN: 'https://one.example,https://two.example',
      RATE_LIMIT_TTL_MS: '60000',
      RATE_LIMIT_MAX: '100',
      JWT_SECRET: 'test-secret-with-at-least-32-characters',
      JWT_EXPIRES_IN_SECONDS: '1800',
    };

    expect(validateEnv(raw)).toBe(raw);
  });

  it.each([
    { PORT: '0' },
    { ENABLE_SWAGGER: 'yes' },
    { LOG_LEVEL: 'verbose' },
    { RATE_LIMIT_TTL_MS: '0' },
    { RATE_LIMIT_TTL_MS: '3600001' },
    { RATE_LIMIT_MAX: '0' },
    { RATE_LIMIT_MAX: '10001' },
    { JWT_EXPIRES_IN_SECONDS: '0' },
    { JWT_EXPIRES_IN_SECONDS: '1801' },
    { CORS_ORIGIN: 'not a URL' },
    { CORS_ORIGIN: 'https://example.com/path' },
  ])('rejects invalid consumed config %#', invalid => {
    expect(() =>
      validateEnv({
        NODE_ENV: NodeEnv.Development,
        JWT_SECRET: VALID_JWT_SECRET,
        ...invalid,
      }),
    ).toThrow('Invalid environment configuration');
  });

  it('requires a strong JWT secret in production', () => {
    expect(() => validateEnv({ NODE_ENV: NodeEnv.Production })).toThrow(
      'Invalid environment configuration',
    );
    expect(() =>
      validateEnv({
        NODE_ENV: NodeEnv.Production,
        JWT_SECRET: 'change-me-min-32-characters-long-secret',
      }),
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnv({
        NODE_ENV: NodeEnv.Production,
        JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toThrow('Invalid environment configuration');
  });

  it('accepts generated-looking production secret material', () => {
    const raw = {
      NODE_ENV: NodeEnv.Production,
      JWT_SECRET: VALID_JWT_SECRET,
    };

    expect(validateEnv(raw)).toBe(raw);
  });

  it('requires NODE_ENV so security policy cannot fail open', () => {
    expect(() => validateEnv({ JWT_SECRET: VALID_JWT_SECRET })).toThrow(
      'Invalid environment configuration',
    );
  });
});
