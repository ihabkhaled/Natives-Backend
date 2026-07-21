import { ConflictError } from '@core/errors/conflict.error';

import {
  TEAM_INVALID_TRANSITION_MESSAGE,
  TEAM_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when a requested team lifecycle move is not permitted from the team's
 * current state (including a no-op move to the state it already holds).
 */
export class TeamInvalidTransitionError extends ConflictError {
  constructor() {
    super(TEAM_INVALID_TRANSITION_MESSAGE, TEAM_INVALID_TRANSITION_MESSAGE_KEY);
  }
}
