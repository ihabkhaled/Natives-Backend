import { IntegrationError } from '@core/errors/integration.error';
import { NotFoundError } from '@core/errors/not-found.error';
import { describe, expect, it } from 'vitest';

import { toDatabaseError } from './database-error.mapper';

describe('toDatabaseError', () => {
  it('passes an existing IntegrationError through unchanged', () => {
    const original = new IntegrationError(
      'boom',
      'errors.database.requestFailed',
    );

    expect(toDatabaseError(original)).toBe(original);
  });

  it('passes a domain AppError raised inside a transaction through unchanged', () => {
    const original = new NotFoundError('missing', 'errors.identity.thing');

    expect(toDatabaseError(original)).toBe(original);
  });

  it('wraps an unknown driver error in a safe typed error', () => {
    const wrapped = toDatabaseError(
      new Error('password authentication failed for user "svc"'),
    );

    expect(wrapped).toBeInstanceOf(IntegrationError);
    expect(wrapped.messageKey).toBe('errors.database.requestFailed');
    expect(wrapped.message).not.toContain('password');
  });
});
