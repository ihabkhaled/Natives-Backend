import { HttpException, HttpStatus } from '@nestjs/common';
import { SERVER_ERROR_MIN_STATUS } from '@shared/constants';

import { AppError } from './app-error';
import {
  GENERIC_ERROR_MESSAGE,
  GENERIC_ERROR_MESSAGE_KEY,
  HTTP_ERROR_MESSAGE_KEYS,
  HTTP_REQUEST_FAILED_MESSAGE,
  HTTP_REQUEST_FAILED_MESSAGE_KEY,
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
    const statusCode = exception.getStatus();
    if (statusCode < SERVER_ERROR_MIN_STATUS) {
      return {
        statusCode,
        messageKey:
          HTTP_ERROR_MESSAGE_KEYS.get(statusCode) ??
          HTTP_REQUEST_FAILED_MESSAGE_KEY,
        message: HTTP_REQUEST_FAILED_MESSAGE,
      };
    }
    return {
      statusCode,
      messageKey: GENERIC_ERROR_MESSAGE_KEY,
      message: GENERIC_ERROR_MESSAGE,
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    messageKey: GENERIC_ERROR_MESSAGE_KEY,
    message: GENERIC_ERROR_MESSAGE,
  };
}
