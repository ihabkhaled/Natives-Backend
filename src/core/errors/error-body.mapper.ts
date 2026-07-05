import { HttpException, HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';
import {
  GENERIC_ERROR_MESSAGE,
  GENERIC_ERROR_MESSAGE_KEY,
} from './error.constants';
import type { ErrorBody } from './error.types';

/**
 * Maps any thrown value to a safe, client-facing error body. Known `AppError`s
 * keep their status + messageKey; framework `HttpException`s keep their status
 * under a generic key; anything else becomes an opaque 500. Never leaks stack
 * traces, SQL, or secrets. See rules/18.
 */
export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof AppError) {
    return {
      statusCode: exception.status,
      messageKey: exception.messageKey,
      message: exception.message,
    };
  }

  if (exception instanceof HttpException) {
    return {
      statusCode: exception.getStatus(),
      messageKey: GENERIC_ERROR_MESSAGE_KEY,
      message: exception.message,
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    messageKey: GENERIC_ERROR_MESSAGE_KEY,
    message: GENERIC_ERROR_MESSAGE,
  };
}
