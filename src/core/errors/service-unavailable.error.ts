import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

/**
 * A dependency required to serve the request is temporarily unavailable (e.g.
 * the database is unreachable at a readiness probe). Maps to HTTP 503 with a
 * safe messageKey; never carries driver internals.
 */
export class ServiceUnavailableError extends AppError {
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;
}
