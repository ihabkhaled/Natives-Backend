import { ConflictError } from '@core/errors/conflict.error';

import {
  ATTENDANCE_LOCKED_MESSAGE,
  ATTENDANCE_LOCKED_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when a plain record/check-in targets a sheet that is already finalized.
 * Once finalized, changes must go through the audited correction workflow, so the
 * open-only write path refuses rather than silently editing locked attendance.
 */
export class AttendanceLockedError extends ConflictError {
  constructor() {
    super(ATTENDANCE_LOCKED_MESSAGE, ATTENDANCE_LOCKED_MESSAGE_KEY);
  }
}
