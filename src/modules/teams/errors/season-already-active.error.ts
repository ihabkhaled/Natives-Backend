import { ConflictError } from '@core/errors/conflict.error';

import {
  SEASON_ALREADY_ACTIVE_MESSAGE,
  SEASON_ALREADY_ACTIVE_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when activating a season would give a team two current seasons. The
 * partial unique index `ux_seasons_one_active_per_team` is the database backstop;
 * this error is the typed, message-keyed form callers see.
 */
export class SeasonAlreadyActiveError extends ConflictError {
  constructor() {
    super(SEASON_ALREADY_ACTIVE_MESSAGE, SEASON_ALREADY_ACTIVE_MESSAGE_KEY);
  }
}
