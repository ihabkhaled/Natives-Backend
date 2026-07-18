import type { ErrorMessageKey } from '@core/errors/error.types';

export const PASSWORD_HASH_PORT = Symbol('PASSWORD_HASH_PORT');

export const AUTH_PASSWORD_SALT_ROUNDS = 12;

export const AUTH_TOKEN_ISSUE_FAILED_MESSAGE =
  'Authentication token could not be issued';
export const AUTH_TOKEN_ISSUE_FAILED_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.tokenIssueFailed';
