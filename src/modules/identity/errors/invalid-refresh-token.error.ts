import { UnauthorizedError } from '@core/errors/unauthorized.error';

import {
  INVALID_REFRESH_TOKEN_MESSAGE,
  INVALID_REFRESH_TOKEN_MESSAGE_KEY,
} from '../model/identity.constants';

/**
 * Raised when a presented refresh token is unknown, expired, revoked, or has
 * already been rotated (reuse). The message is generic and identical in every
 * case so a caller cannot probe session state.
 */
export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super(INVALID_REFRESH_TOKEN_MESSAGE, INVALID_REFRESH_TOKEN_MESSAGE_KEY);
  }
}
