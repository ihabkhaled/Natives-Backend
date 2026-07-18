import { AttendanceState } from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceSheet,
  AttendanceSheetStatusView,
  AttendanceSheetView,
  AttendanceView,
  ParticipationInputs,
  ParticipationView,
  RosterEntry,
} from '../model/attendance.types';
import type { PageRequest } from '../model/practices.types';

/**
 * Pure mappers from attendance domain rows to API response projections. Rounding
 * of the attendance rate happens ONLY here (presentation), never in the domain
 * computation, so the unrounded rate stays reproducible from cited inputs.
 */

const PERCENT_SCALE = 100;
const PERCENT_ROUNDING = 10;

/** Map a stored attendance record to the member-facing view. */
export function toAttendanceView(record: AttendanceRecord): AttendanceView {
  return {
    sessionId: record.sessionId,
    membershipId: record.membershipId,
    status: record.status,
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
    latenessMinutes: record.latenessMinutes,
    excuseCategory: record.excuseCategory,
    source: record.source,
    recordedAt: record.recordedAt,
    version: record.version,
  };
}

/**
 * The explicit "not recorded yet" view for a member with no stored row. Absence is
 * modelled as a null status (null-not-zero) rather than a 404 or a coerced ABSENT.
 */
export function notRecordedView(
  sessionId: string,
  membershipId: string,
): AttendanceView {
  return {
    sessionId,
    membershipId,
    status: null,
    checkInAt: null,
    checkOutAt: null,
    latenessMinutes: null,
    excuseCategory: null,
    source: null,
    recordedAt: null,
    version: null,
  };
}

/** Map a sheet (or its absence) + roster rows to the attendance list view. */
export function toSheetView(
  sessionId: string,
  sheet: AttendanceSheet | null,
  items: readonly RosterEntry[],
  total: number,
  page: PageRequest,
): AttendanceSheetView {
  return {
    sessionId,
    state: sheet === null ? AttendanceState.Open : sheet.state,
    finalizedAt: sheet === null ? null : sheet.finalizedAt,
    version: sheet === null ? null : sheet.version,
    items,
    total,
    limit: page.limit,
    offset: page.offset,
  };
}

/** Map a finalized/corrected sheet + record count to the status view. */
export function toSheetStatusView(
  sheet: AttendanceSheet,
  recordCount: number,
): AttendanceSheetStatusView {
  return {
    sessionId: sheet.sessionId,
    state: sheet.state,
    finalizedAt: sheet.finalizedAt,
    recordCount,
    version: sheet.version,
  };
}

/** Round an unrounded rate to a display percentage (one decimal), or null. */
function toPercent(rate: number | null): number | null {
  if (rate === null) {
    return null;
  }
  return Math.round(rate * PERCENT_SCALE * PERCENT_ROUNDING) / PERCENT_ROUNDING;
}

/** Map computed participation inputs to the API view with a display percentage. */
export function toParticipationView(
  membershipId: string,
  seasonId: string | null,
  inputs: ParticipationInputs,
): ParticipationView {
  return {
    ...inputs,
    membershipId,
    seasonId,
    attendanceRatePercent: toPercent(inputs.attendanceRate),
  };
}
