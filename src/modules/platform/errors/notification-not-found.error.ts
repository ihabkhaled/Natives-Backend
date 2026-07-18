import { NotFoundError } from '@core/errors/not-found.error';

import {
  NOTIFICATION_NOT_FOUND_MESSAGE,
  NOTIFICATION_NOT_FOUND_MESSAGE_KEY,
} from '../model/platform.constants';

/** Raised when a notification does not exist or is not owned by the caller. */
export class NotificationNotFoundError extends NotFoundError {
  constructor() {
    super(NOTIFICATION_NOT_FOUND_MESSAGE, NOTIFICATION_NOT_FOUND_MESSAGE_KEY);
  }
}
