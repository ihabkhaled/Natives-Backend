import { ValidationError } from '@core/errors/validation.error';

import {
  NOTIFICATION_QUIET_HOURS_MESSAGE,
  NOTIFICATION_QUIET_HOURS_MESSAGE_KEY,
} from '../model/platform.constants';

/** Raised for an ICU-unknown timezone or invalid local quiet-hour bound. */
export class NotificationQuietHoursError extends ValidationError {
  constructor() {
    super(
      NOTIFICATION_QUIET_HOURS_MESSAGE,
      NOTIFICATION_QUIET_HOURS_MESSAGE_KEY,
    );
  }
}
