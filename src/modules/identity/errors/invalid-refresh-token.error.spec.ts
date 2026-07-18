import { UnauthorizedError } from '@core/errors/unauthorized.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InvalidRefreshTokenError } from './invalid-refresh-token.error';

describe('InvalidRefreshTokenError', () => {
  it('carries the generic refresh message key and 401 status', () => {
    const error = new InvalidRefreshTokenError();

    expect(error.messageKey).toBe('errors.auth.invalidRefreshToken');
    expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('is an instance of the UnauthorizedError base', () => {
    expect(new InvalidRefreshTokenError()).toBeInstanceOf(UnauthorizedError);
  });
});
