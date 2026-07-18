import { ConflictError } from '@core/errors/conflict.error';

import {
  CALENDAR_FEED_LIMIT_MESSAGE,
  CALENDAR_FEED_LIMIT_MESSAGE_KEY,
} from '../model/calendar.constants';

/** Raised when one owner reaches the bounded active-feed credential limit. */
export class CalendarFeedLimitError extends ConflictError {
  constructor() {
    super(CALENDAR_FEED_LIMIT_MESSAGE, CALENDAR_FEED_LIMIT_MESSAGE_KEY);
  }
}
