import { ConflictError } from '@core/errors/conflict.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InvitationConflictError } from './invitation-conflict.error';

describe('InvitationConflictError', () => {
  it('carries the invitation-conflict message key and 409 status', () => {
    const error = new InvitationConflictError();

    expect(error.messageKey).toBe('errors.identity.invitationConflict');
    expect(error.status).toBe(HttpStatus.CONFLICT);
  });

  it('is an instance of the ConflictError base', () => {
    expect(new InvitationConflictError()).toBeInstanceOf(ConflictError);
  });
});
