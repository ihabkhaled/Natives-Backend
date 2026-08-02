import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

/**
 * The caller (or an internal dependency acting on the caller's behalf, such
 * as the outbound-email send throttle) exceeded a rate limit. Maps to HTTP
 * 429; distinct from the global `@nestjs/throttler` guard's own 429, which
 * never reaches application code.
 */
export class TooManyRequestsError extends AppError {
  readonly status = HttpStatus.TOO_MANY_REQUESTS;
}
