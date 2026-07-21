import { NotFoundError } from '@core/errors/not-found.error';

import {
  CURRENT_SEASON_NOT_FOUND_MESSAGE,
  CURRENT_SEASON_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a team has no active season to resolve as its current season. */
export class CurrentSeasonNotFoundError extends NotFoundError {
  constructor() {
    super(
      CURRENT_SEASON_NOT_FOUND_MESSAGE,
      CURRENT_SEASON_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
