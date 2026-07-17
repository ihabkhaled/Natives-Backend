import { describe, expect, it } from 'vitest';

import { sanitizeLogContext } from './log-context.sanitizer';
import { CIRCULAR_LOG_VALUE, REDACT_CENSOR } from './logger.constants';

describe('sanitizeLogContext', () => {
  it('redacts sensitive keys recursively in objects and arrays', () => {
    const context = {
      requestId: 'request-1',
      password: 'password-value',
      nested: {
        accessToken: 'token-value',
        passwordHash: 'hash-value',
        'set-cookie': 'session=value',
        items: [{ apiKey: 'api-key-value', safe: 'visible' }],
      },
    };

    expect(sanitizeLogContext(context)).toEqual({
      requestId: 'request-1',
      password: REDACT_CENSOR,
      nested: {
        accessToken: REDACT_CENSOR,
        passwordHash: REDACT_CENSOR,
        'set-cookie': REDACT_CENSOR,
        items: [{ apiKey: REDACT_CENSOR, safe: 'visible' }],
      },
    });
  });

  it('keeps redacted Error diagnostics', () => {
    const sanitized = sanitizeLogContext({
      err: new Error('token=secret-value Bearer bearer-value'),
    });

    expect(sanitized).toEqual({
      err: expect.objectContaining({
        name: 'Error',
        message: 'token=[Redacted] Bearer [Redacted]',
        stack: expect.any(String),
      }),
    });
    expect(JSON.stringify(sanitized)).not.toContain('secret-value');
    expect(JSON.stringify(sanitized)).not.toContain('bearer-value');
  });

  it('serializes dates without changing their value', () => {
    const timestamp = new Date('2024-01-01T00:00:00.000Z');

    expect(sanitizeLogContext({ timestamp })).toEqual({
      timestamp: '2024-01-01T00:00:00.000Z',
    });
  });

  it('sanitizes nested error causes', () => {
    const error = new Error('outer', {
      cause: 'authorization: Bearer private-value',
    });

    const sanitized = JSON.stringify(sanitizeLogContext({ error }));

    expect(sanitized).toContain('authorization=[Redacted]');
    expect(sanitized).not.toContain('private-value');
  });

  it('redacts quoted JSON values containing spaces from error text', () => {
    const sanitized = JSON.stringify(
      sanitizeLogContext({
        error: new Error('payload={"password":"private value"}'),
      }),
    );

    expect(sanitized).toContain('password=[Redacted]');
    expect(sanitized).not.toContain('private value');
  });

  it('redacts cookie assignments from error text', () => {
    const sanitized = JSON.stringify(
      sanitizeLogContext({
        error: new Error('set-cookie=session-value cookie=secondary-value'),
      }),
    );

    expect(sanitized).toContain('set-cookie=[Redacted]');
    expect(sanitized).toContain('cookie=[Redacted]');
    expect(sanitized).not.toContain('session-value');
    expect(sanitized).not.toContain('secondary-value');
  });

  it('replaces circular array references', () => {
    const values: unknown[] = [];
    values.push(values);

    expect(sanitizeLogContext({ values })).toEqual({
      values: [CIRCULAR_LOG_VALUE],
    });
  });

  it('replaces circular references', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(sanitizeLogContext(circular)).toEqual({
      self: CIRCULAR_LOG_VALUE,
    });
  });
});
