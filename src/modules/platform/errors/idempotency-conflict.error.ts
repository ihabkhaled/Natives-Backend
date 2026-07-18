import { ConflictError } from '@core/errors/conflict.error';

import {
  IDEMPOTENCY_CONFLICT_MESSAGE,
  IDEMPOTENCY_CONFLICT_MESSAGE_KEY,
} from '../model/platform.constants';

/**
 * Raised when an idempotency key is reused with a different request payload, or
 * while a first attempt for the same key is still in flight. Maps to HTTP 409.
 */
export class IdempotencyConflictError extends ConflictError {
  constructor() {
    super(IDEMPOTENCY_CONFLICT_MESSAGE, IDEMPOTENCY_CONFLICT_MESSAGE_KEY);
  }
}
