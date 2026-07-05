import type { HttpStatus } from '@nestjs/common';

import type { ErrorMessageKey } from './error.types';

/**
 * Base class for every user-facing error. Subclasses declare their HTTP status;
 * every instance carries a `messageKey` (errors.<feature>.<key>) that the global
 * exception filter maps to a sanitized response body. Never throw a raw `Error`
 * across the HTTP boundary. See rules/18.
 */
export abstract class AppError extends Error {
  abstract readonly status: HttpStatus;

  readonly messageKey: ErrorMessageKey;

  constructor(message: string, messageKey: ErrorMessageKey) {
    super(message);
    this.messageKey = messageKey;
    this.name = new.target.name;
  }
}
