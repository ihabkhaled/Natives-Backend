import { ConflictError } from '@core/errors/conflict.error';

import {
  INVALID_TRANSITION_MESSAGE,
  INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a session status change is not allowed from its current state. */
export class InvalidSessionTransitionError extends ConflictError {
  constructor() {
    super(INVALID_TRANSITION_MESSAGE, INVALID_TRANSITION_MESSAGE_KEY);
  }
}
