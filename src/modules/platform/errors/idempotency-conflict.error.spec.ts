import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { IDEMPOTENCY_CONFLICT_MESSAGE_KEY } from '../model/platform.constants';
import { IdempotencyConflictError } from './idempotency-conflict.error';

describe('IdempotencyConflictError', () => {
  it('is a 409 with the idempotency conflict message key', () => {
    const error = new IdempotencyConflictError();
    expect(error.status).toBe(HttpStatus.CONFLICT);
    expect(error.messageKey).toBe(IDEMPOTENCY_CONFLICT_MESSAGE_KEY);
  });
});
