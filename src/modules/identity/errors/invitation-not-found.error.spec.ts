import { NotFoundError } from '@core/errors/not-found.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InvitationNotFoundError } from './invitation-not-found.error';

describe('InvitationNotFoundError', () => {
  it('carries the invitation-not-found message key and 404 status', () => {
    const error = new InvitationNotFoundError();

    expect(error.messageKey).toBe('errors.identity.invitationNotFound');
    expect(error.status).toBe(HttpStatus.NOT_FOUND);
  });

  it('is an instance of the NotFoundError base', () => {
    expect(new InvitationNotFoundError()).toBeInstanceOf(NotFoundError);
  });
});
