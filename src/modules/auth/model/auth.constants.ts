import type { ErrorMessageKey } from '@core/errors/error.types';

export const PASSWORD_HASH_PORT = Symbol('PASSWORD_HASH_PORT');

export const AUTH_ROUTE = 'auth';
export const AUTH_LOGIN_ROUTE = 'login';
export const AUTH_API_TAG = 'auth';
export const AUTH_EMAIL_MAX_LENGTH = 320;
export const AUTH_PASSWORD_MIN_LENGTH = 1;
export const AUTH_PASSWORD_MAX_LENGTH = 72;
export const AUTH_DUMMY_PASSWORD_HASH =
  '$2b$10$HobO1TciaomoWrP6K7hnguwCCqn9dOcwHZvC8NUs8//VK2md4KxPO';

export const AUTH_INVALID_CREDENTIALS_MESSAGE = 'Credentials are invalid';
export const AUTH_INVALID_CREDENTIALS_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.invalidCredentials';

export const AUTH_TOKEN_ISSUE_FAILED_MESSAGE =
  'Authentication token could not be issued';
export const AUTH_TOKEN_ISSUE_FAILED_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.tokenIssueFailed';
