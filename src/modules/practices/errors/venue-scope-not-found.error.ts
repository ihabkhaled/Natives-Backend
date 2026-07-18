import { NotFoundError } from '@core/errors/not-found.error';

import {
  VENUE_NOT_FOUND_MESSAGE,
  VENUE_NOT_FOUND_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a referenced venue does not belong to the requested team scope. */
export class VenueScopeNotFoundError extends NotFoundError {
  constructor() {
    super(VENUE_NOT_FOUND_MESSAGE, VENUE_NOT_FOUND_MESSAGE_KEY);
  }
}
