import { ValidationError } from '@core/errors/validation.error';

import {
  INVALID_SCHEDULE_MESSAGE,
  INVALID_SCHEDULE_MESSAGE_KEY,
} from '../model/practices.constants';

/** Raised when a schedule's recurrence, times, or generation horizon is invalid. */
export class InvalidScheduleError extends ValidationError {
  constructor() {
    super(INVALID_SCHEDULE_MESSAGE, INVALID_SCHEDULE_MESSAGE_KEY);
  }
}
