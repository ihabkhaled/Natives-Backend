import { NotFoundError } from '@core/errors/not-found.error';

import {
  SIGNUP_NOT_FOUND_MESSAGE,
  SIGNUP_NOT_FOUND_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when an admin approves or rejects a signup id that does not resolve to
 * a still-pending account. A non-pending or unknown id is reported identically
 * so the endpoint never enumerates account state.
 */
export class SignupNotFoundError extends NotFoundError {
  constructor() {
    super(SIGNUP_NOT_FOUND_MESSAGE, SIGNUP_NOT_FOUND_MESSAGE_KEY);
  }
}
