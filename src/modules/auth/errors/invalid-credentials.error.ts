import { UnauthorizedError } from '@core/errors/unauthorized.error';

import {
  AUTH_INVALID_CREDENTIALS_MESSAGE,
  AUTH_INVALID_CREDENTIALS_MESSAGE_KEY,
} from '../model/auth.constants';

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super(
      AUTH_INVALID_CREDENTIALS_MESSAGE,
      AUTH_INVALID_CREDENTIALS_MESSAGE_KEY,
    );
  }
}
