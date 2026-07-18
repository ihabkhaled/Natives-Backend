import { UnauthorizedError } from '@core/errors/unauthorized.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InvalidCredentialsError } from './invalid-credentials.error';

describe('InvalidCredentialsError', () => {
  it('carries the generic auth message key and 401 status', () => {
    const error = new InvalidCredentialsError();

    expect(error.messageKey).toBe('errors.auth.invalidCredentials');
    expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('is an instance of the UnauthorizedError base', () => {
    expect(new InvalidCredentialsError()).toBeInstanceOf(UnauthorizedError);
  });
});
