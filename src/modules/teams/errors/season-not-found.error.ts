import { NotFoundError } from '@core/errors/not-found.error';

import {
  SEASON_NOT_FOUND_MESSAGE,
  SEASON_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a season does not exist within the requested team scope. */
export class SeasonNotFoundError extends NotFoundError {
  constructor() {
    super(SEASON_NOT_FOUND_MESSAGE, SEASON_NOT_FOUND_MESSAGE_KEY);
  }
}
