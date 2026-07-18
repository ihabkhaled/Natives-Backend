import { UnauthorizedError } from '@core/errors/unauthorized.error';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SESSION_CONTEXT_REQUIRED_MESSAGE_KEY } from '../model/identity.constants';
import { SessionContextRequiredError } from './session-context-required.error';

describe('SessionContextRequiredError', () => {
  it('carries the safe unauthorized contract', () => {
    const error = new SessionContextRequiredError();

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.messageKey).toBe(SESSION_CONTEXT_REQUIRED_MESSAGE_KEY);
  });
});
