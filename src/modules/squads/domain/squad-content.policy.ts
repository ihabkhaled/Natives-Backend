import { SquadValidationError } from '../errors/squad-validation.error';
import {
  ATTENDANCE_THRESHOLD_MAX,
  ATTENDANCE_THRESHOLD_MIN,
} from '../model/squads.constants';
import type { SquadContent } from '../model/squads.types';

/**
 * Pure content invariants for a squad: the attendance threshold is a percentage
 * within [0, 100]. The threshold is only ever used to compute an ADVISORY
 * attendance signal — it never gates selection — but an out-of-range value is a
 * 400 domain validation error. No side effects, no persistence.
 */
export function assertSquadContent(content: SquadContent): void {
  if (
    content.attendanceThresholdPct < ATTENDANCE_THRESHOLD_MIN ||
    content.attendanceThresholdPct > ATTENDANCE_THRESHOLD_MAX
  ) {
    throw new SquadValidationError();
  }
}
