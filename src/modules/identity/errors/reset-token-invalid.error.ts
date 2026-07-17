import { ValidationError } from '@core/errors/validation.error';

import {
  RESET_TOKEN_INVALID_MESSAGE,
  RESET_TOKEN_INVALID_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when a password-reset token is unknown, expired, or already consumed.
 * Generic by design — the token is the secret.
 */
export class ResetTokenInvalidError extends ValidationError {
  constructor() {
    super(RESET_TOKEN_INVALID_MESSAGE, RESET_TOKEN_INVALID_MESSAGE_KEY);
  }
}
