import { ConflictError } from '@core/errors/conflict.error';

import {
  ATTENDANCE_RULE_MISSING_MESSAGE,
  ATTENDANCE_RULE_MISSING_MESSAGE_KEY,
} from '../model/attendance.constants';

/**
 * Raised when a participation projection is requested but no default scoring rule
 * is configured. The migration always seeds one candidate rule, so this is a
 * defensive invariant guard rather than an ordinary user error.
 */
export class AttendanceRuleMissingError extends ConflictError {
  constructor() {
    super(ATTENDANCE_RULE_MISSING_MESSAGE, ATTENDANCE_RULE_MISSING_MESSAGE_KEY);
  }
}
