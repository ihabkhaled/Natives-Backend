import { NotFoundError } from '@core/errors/not-found.error';

import {
  SESSION_NOT_FOUND_MESSAGE,
  SESSION_NOT_FOUND_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a practice session does not exist within the requested team scope. */
export class PracticeSessionNotFoundError extends NotFoundError {
  constructor() {
    super(SESSION_NOT_FOUND_MESSAGE, SESSION_NOT_FOUND_MESSAGE_KEY);
  }
}
