import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  ATTENDANCE_NOT_MEMBER_MESSAGE,
  ATTENDANCE_NOT_MEMBER_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when a caller self-checks-in but has no active membership in the target
 * team — the team/season-scope + active-membership authorization check that the
 * global permission guard cannot express.
 */
export class AttendanceNotMemberError extends ForbiddenError {
  constructor() {
    super(ATTENDANCE_NOT_MEMBER_MESSAGE, ATTENDANCE_NOT_MEMBER_MESSAGE_KEY);
  }
}
