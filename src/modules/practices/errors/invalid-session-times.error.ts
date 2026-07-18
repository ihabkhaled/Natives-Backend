import { ValidationError } from '@core/errors/validation.error';

import {
  INVALID_SESSION_TIMES_MESSAGE,
  INVALID_SESSION_TIMES_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a session's supplied end instant is before its start instant. */
export class InvalidSessionTimesError extends ValidationError {
  constructor() {
    super(INVALID_SESSION_TIMES_MESSAGE, INVALID_SESSION_TIMES_MESSAGE_KEY);
  }
}
