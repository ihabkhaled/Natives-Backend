import { AppError } from '@core/errors/app-error';
import { IntegrationError } from '@core/errors/integration.error';

import {
  DATABASE_ERROR_MESSAGE,
  DATABASE_ERROR_MESSAGE_KEY,
} from './database.constants';

/**
 * Convert any thrown database/driver value into a safe, typed `AppError`. Driver
 * messages, SQL, and connection details never reach the client — the global
 * exception filter maps the returned error to a sanitized body. Existing
 * `AppError`s (including domain errors raised inside a transaction, such as a
 * generic auth/invitation/reset failure) pass through unchanged so their status
 * and messageKey are preserved rather than masked as a database fault.
 */
export function toDatabaseError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return new IntegrationError(
    DATABASE_ERROR_MESSAGE,
    DATABASE_ERROR_MESSAGE_KEY,
  );
}
