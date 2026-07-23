import { ConflictError } from '@core/errors/conflict.error';

import {
  ATTENDANCE_CHECK_IN_CLOSED_MESSAGE,
  ATTENDANCE_CHECK_IN_CLOSED_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when a self check-in arrives outside the explicit window (before
 * `startsAt − 60 min` or after the session end) or targets a session that is not
 * check-in-able (draft/cancelled/completed/archived). 409, matching the module's
 * conflict-style domain errors, with a stable message key for the client map.
 */
export class CheckInWindowClosedError extends ConflictError {
  constructor() {
    super(
      ATTENDANCE_CHECK_IN_CLOSED_MESSAGE,
      ATTENDANCE_CHECK_IN_CLOSED_MESSAGE_KEY,
    );
  }
}
