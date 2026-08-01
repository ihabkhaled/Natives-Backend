import { ConflictError } from '@core/errors/conflict.error';

import {
  SIGNUP_CONFLICT_MESSAGE,
  SIGNUP_CONFLICT_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when a self-signup collides with an existing account, a pending signup,
 * or an active invitation for the same email.
 */
export class SignupConflictError extends ConflictError {
  constructor() {
    super(SIGNUP_CONFLICT_MESSAGE, SIGNUP_CONFLICT_MESSAGE_KEY);
  }
}
