import { NotFoundError } from '@core/errors/not-found.error';

import {
  CALENDAR_FEED_UNAVAILABLE_MESSAGE,
  CALENDAR_FEED_UNAVAILABLE_MESSAGE_KEY,
} from '../model/calendar.constants';

/** Generic token/ownership/scope failure that does not reveal credential state. */
export class CalendarFeedUnavailableError extends NotFoundError {
  constructor() {
    super(
      CALENDAR_FEED_UNAVAILABLE_MESSAGE,
      CALENDAR_FEED_UNAVAILABLE_MESSAGE_KEY,
    );
  }
}
