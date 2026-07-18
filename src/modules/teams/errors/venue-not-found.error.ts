import { NotFoundError } from '@core/errors/not-found.error';

import {
  VENUE_NOT_FOUND_MESSAGE,
  VENUE_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a venue does not exist within the requested team scope. */
export class VenueNotFoundError extends NotFoundError {
  constructor() {
    super(VENUE_NOT_FOUND_MESSAGE, VENUE_NOT_FOUND_MESSAGE_KEY);
  }
}
