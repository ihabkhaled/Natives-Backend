import { ConflictError } from '@core/errors/conflict.error';

import {
  SEASON_INVALID_TRANSITION_MESSAGE,
  SEASON_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when a requested season lifecycle move is not permitted from the
 * season's current state (including a no-op move to its current state).
 */
export class SeasonInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      SEASON_INVALID_TRANSITION_MESSAGE,
      SEASON_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
