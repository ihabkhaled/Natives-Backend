import { ConflictError } from '@core/errors/conflict.error';

import {
  INVALID_TRANSITION_MESSAGE,
  INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when a membership state change is not allowed from the current state. */
export class InvalidTransitionError extends ConflictError {
  constructor() {
    super(INVALID_TRANSITION_MESSAGE, INVALID_TRANSITION_MESSAGE_KEY);
  }
}
