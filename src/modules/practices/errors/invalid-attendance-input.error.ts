import { ValidationError } from '@core/errors/validation.error';

import {
  ATTENDANCE_INVALID_INPUT_MESSAGE,
  ATTENDANCE_INVALID_INPUT_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised for a mark whose fields are inconsistent with its status — lateness on a
 * non-late status, an excuse category on a non-excused status, or a duplicate
 * membership within a bulk payload. Cross-field rules the DTO bounds cannot express.
 */
export class InvalidAttendanceInputError extends ValidationError {
  constructor() {
    super(
      ATTENDANCE_INVALID_INPUT_MESSAGE,
      ATTENDANCE_INVALID_INPUT_MESSAGE_KEY,
    );
  }
}
