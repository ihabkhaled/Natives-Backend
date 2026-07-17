import type { ErrorMessageKey } from '@core/errors/error.types';

export const HEALTH_ROUTE = 'health';
export const HEALTH_API_TAG = 'health';
export const READINESS_ROUTE = 'ready';

export const DATABASE_UNAVAILABLE_MESSAGE =
  'The service is not ready: the database is unavailable';
export const DATABASE_UNAVAILABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.health.databaseUnavailable';
