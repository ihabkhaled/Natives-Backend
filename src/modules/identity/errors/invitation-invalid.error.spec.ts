import { ValidationError } from '@core/errors/validation.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InvitationInvalidError } from './invitation-invalid.error';

describe('InvitationInvalidError', () => {
  it('carries the invitation-invalid message key and 400 status', () => {
    const error = new InvitationInvalidError();

    expect(error.messageKey).toBe('errors.identity.invitationInvalid');
    expect(error.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('is an instance of the ValidationError base', () => {
    expect(new InvitationInvalidError()).toBeInstanceOf(ValidationError);
  });
});
