import { IntegrationError } from '@core/errors/integration.error';

import {
  DATABASE_ERROR_MESSAGE,
  DATABASE_ERROR_MESSAGE_KEY,
} from './database.constants';

/**
 * Convert any thrown database/driver value into a safe, typed `AppError`. Driver
 * messages, SQL, and connection details never reach the client — the global
 * exception filter maps the returned error to a sanitized body. Existing
 * `AppError`s pass through unchanged.
 */
export function toDatabaseError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) {
    return error;
  }
  return new IntegrationError(
    DATABASE_ERROR_MESSAGE,
    DATABASE_ERROR_MESSAGE_KEY,
  );
}
