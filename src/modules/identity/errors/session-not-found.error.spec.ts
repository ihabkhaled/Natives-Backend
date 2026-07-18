import { NotFoundError } from '@core/errors/not-found.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SESSION_NOT_FOUND_MESSAGE_KEY } from '../model/identity.constants';
import { SessionNotFoundError } from './session-not-found.error';

describe('SessionNotFoundError', () => {
  it('carries the safe not-found contract', () => {
    const error = new SessionNotFoundError();

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.status).toBe(HttpStatus.NOT_FOUND);
    expect(error.messageKey).toBe(SESSION_NOT_FOUND_MESSAGE_KEY);
  });
});
