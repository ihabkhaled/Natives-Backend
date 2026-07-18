import { ConflictError } from '@core/errors/conflict.error';

import {
  VERSION_CONFLICT_MESSAGE,
  VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/members.constants';

/**
 * Raised when an optimistic-concurrency write loses: the caller's expected
 * version no longer matches the persisted row because it changed concurrently.
 */
export class OptimisticConflictError extends ConflictError {
  constructor() {
    super(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_MESSAGE_KEY);
  }
}
