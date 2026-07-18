import { UnauthorizedError } from '@core/errors/unauthorized.error';

import {
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Generic authentication failure. Deliberately identical for unknown accounts,
 * wrong passwords, locked accounts, and non-active users so responses never
 * permit account enumeration.
 */
export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE, INVALID_CREDENTIALS_MESSAGE_KEY);
  }
}
