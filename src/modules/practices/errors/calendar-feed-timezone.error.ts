import { ValidationError } from '@core/errors/validation.error';

import {
  CALENDAR_FEED_TIMEZONE_MESSAGE,
  CALENDAR_FEED_TIMEZONE_MESSAGE_KEY,
} from '../model/calendar.constants';

/** Raised when ICU cannot resolve the requested IANA timezone. */
export class CalendarFeedTimezoneError extends ValidationError {
  constructor() {
    super(CALENDAR_FEED_TIMEZONE_MESSAGE, CALENDAR_FEED_TIMEZONE_MESSAGE_KEY);
  }
}
