import { ValidationError } from '@core/errors/validation.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ResetTokenInvalidError } from './reset-token-invalid.error';

describe('ResetTokenInvalidError', () => {
  it('carries the reset-token-invalid message key and 400 status', () => {
    const error = new ResetTokenInvalidError();

    expect(error.messageKey).toBe('errors.identity.resetTokenInvalid');
    expect(error.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('is an instance of the ValidationError base', () => {
    expect(new ResetTokenInvalidError()).toBeInstanceOf(ValidationError);
  });
});
