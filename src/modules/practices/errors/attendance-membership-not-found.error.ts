import { NotFoundError } from '@core/errors/not-found.error';

import {
  ATTENDANCE_MEMBERSHIP_NOT_FOUND_MESSAGE,
  ATTENDANCE_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when a coach marks or corrects attendance for a membership that does not
 * belong to the team scope — a cross-team reference resolves to not-found rather
 * than a raw foreign-key violation.
 */
export class AttendanceMembershipNotFoundError extends NotFoundError {
  constructor() {
    super(
      ATTENDANCE_MEMBERSHIP_NOT_FOUND_MESSAGE,
      ATTENDANCE_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
