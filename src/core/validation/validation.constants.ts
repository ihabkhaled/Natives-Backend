import type { ErrorMessageKey } from '@core/errors/error.types';

export const VALIDATION_LOG_MESSAGE = 'Request DTO validation failed';

export const UUID_VERSION = '4';
export const UUID_INVALID_MESSAGE = 'UUID parameter is invalid';
export const UUID_INVALID_MESSAGE_KEY: ErrorMessageKey =
  'errors.validation.invalidUuid';
