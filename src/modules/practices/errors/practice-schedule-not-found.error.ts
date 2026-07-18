import { NotFoundError } from '@core/errors/not-found.error';

import {
  SCHEDULE_NOT_FOUND_MESSAGE,
  SCHEDULE_NOT_FOUND_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a practice schedule does not exist within the requested team scope. */
export class PracticeScheduleNotFoundError extends NotFoundError {
  constructor() {
    super(SCHEDULE_NOT_FOUND_MESSAGE, SCHEDULE_NOT_FOUND_MESSAGE_KEY);
  }
}
