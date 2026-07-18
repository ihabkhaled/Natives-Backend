import { NotFoundError } from '@core/errors/not-found.error';

import {
  ATTENDANCE_SHEET_NOT_FOUND_MESSAGE,
  ATTENDANCE_SHEET_NOT_FOUND_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when finalize or correct is attempted for a session that has no attendance
 * sheet yet — nothing has been recorded, so there is nothing to finalize or correct.
 */
export class AttendanceSheetNotFoundError extends NotFoundError {
  constructor() {
    super(
      ATTENDANCE_SHEET_NOT_FOUND_MESSAGE,
      ATTENDANCE_SHEET_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
