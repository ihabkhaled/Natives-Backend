import { NotFoundError } from '@core/errors/not-found.error';

import {
  SEASON_NOT_FOUND_MESSAGE,
  SEASON_NOT_FOUND_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a referenced season does not belong to the requested team scope. */
export class SeasonScopeNotFoundError extends NotFoundError {
  constructor() {
    super(SEASON_NOT_FOUND_MESSAGE, SEASON_NOT_FOUND_MESSAGE_KEY);
  }
}
