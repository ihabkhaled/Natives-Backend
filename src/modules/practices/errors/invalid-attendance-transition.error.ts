import { ConflictError } from '@core/errors/conflict.error';

import {
  ATTENDANCE_INVALID_TRANSITION_MESSAGE,
  ATTENDANCE_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when a finalize/correct action is not allowed from the sheet's current
 * state — e.g. finalizing an already-finalized sheet, or correcting a sheet that is
 * still open. Validated by the pure attendance state machine.
 */
export class InvalidAttendanceTransitionError extends ConflictError {
  constructor() {
    super(
      ATTENDANCE_INVALID_TRANSITION_MESSAGE,
      ATTENDANCE_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
