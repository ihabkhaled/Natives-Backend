import type { ErrorMessageKey } from '@core/errors/error.types';

export const AUTH_TOKEN_PORT = Symbol('AUTH_TOKEN_PORT');

export const AUTH_PUBLIC_KEY = 'auth.public';
export const AUTH_PERMISSIONS_KEY = 'auth.permissions';

// Route param/query keys the scope guard reads to resolve team/season scope.
export const AUTH_TEAM_ID_KEY = 'teamId';
export const AUTH_SEASON_ID_KEY = 'seasonId';

export const AUTH_BEARER_PATTERN = /^Bearer +(\S+)$/iu;
export const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u;

export const AUTH_TOKEN_REQUIRED_MESSAGE = 'Authentication token is required';
export const AUTH_TOKEN_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.tokenRequired';

export const AUTH_INVALID_TOKEN_MESSAGE = 'Authentication token is invalid';
export const AUTH_INVALID_TOKEN_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.invalidToken';

export const AUTH_IDENTITY_REQUIRED_MESSAGE =
  'Authenticated identity is required';
export const AUTH_IDENTITY_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.identityRequired';

export const AUTH_PERMISSION_DENIED_MESSAGE = 'Required permission is missing';
export const AUTH_PERMISSION_DENIED_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.permissionDenied';
