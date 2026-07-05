import type { ErrorMessageKey } from './error.types';

export const GENERIC_ERROR_MESSAGE = 'Internal server error';
export const GENERIC_ERROR_MESSAGE_KEY: ErrorMessageKey =
  'errors.common.internalError';

export const VALIDATION_FAILED_MESSAGE = 'Request validation failed';
export const VALIDATION_FAILED_MESSAGE_KEY: ErrorMessageKey =
  'errors.validation.failed';
