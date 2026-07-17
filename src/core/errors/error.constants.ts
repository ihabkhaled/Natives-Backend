import { HttpStatus } from '@nestjs/common';

import type { ErrorMessageKey } from './error.types';

export const GENERIC_ERROR_MESSAGE = 'Internal server error';
export const GENERIC_ERROR_MESSAGE_KEY: ErrorMessageKey =
  'errors.common.internalError';

export const VALIDATION_FAILED_MESSAGE = 'Request validation failed';
export const VALIDATION_FAILED_MESSAGE_KEY: ErrorMessageKey =
  'errors.validation.failed';

export const HTTP_REQUEST_FAILED_MESSAGE = 'Request failed';
export const HTTP_REQUEST_FAILED_MESSAGE_KEY: ErrorMessageKey =
  'errors.http.requestFailed';
export const HTTP_ERROR_MESSAGE_KEYS: ReadonlyMap<number, ErrorMessageKey> =
  new Map([
    [HttpStatus.BAD_REQUEST, 'errors.http.badRequest'],
    [HttpStatus.UNAUTHORIZED, 'errors.http.unauthorized'],
    [HttpStatus.FORBIDDEN, 'errors.http.forbidden'],
    [HttpStatus.NOT_FOUND, 'errors.http.notFound'],
    [HttpStatus.CONFLICT, 'errors.http.conflict'],
    [HttpStatus.UNPROCESSABLE_ENTITY, 'errors.http.unprocessableEntity'],
    [HttpStatus.TOO_MANY_REQUESTS, 'errors.http.tooManyRequests'],
  ]);
