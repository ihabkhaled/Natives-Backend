import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_INVALID_TRANSITION_MESSAGE,
  ROSTER_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      ROSTER_INVALID_TRANSITION_MESSAGE,
      ROSTER_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
