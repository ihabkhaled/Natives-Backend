import { AttendanceState } from '../model/attendance.enums';

/**
 * Pure attendance-sheet lifecycle state machine. Encodes the OPEN → FINALIZED →
 * CORRECTED workflow: an OPEN sheet accepts new marks and self check-ins and may be
 * finalized; a FINALIZED sheet is locked and may only move to CORRECTED through an
 * audited correction; a CORRECTED sheet stays CORRECTED across further corrections.
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<AttendanceState, readonly AttendanceState[]> =
  new Map([
    [AttendanceState.Open, [AttendanceState.Finalized]],
    [AttendanceState.Finalized, [AttendanceState.Corrected]],
    [AttendanceState.Corrected, []],
  ]);

/** The set of states reachable from `from` in one plain transition. */
export function allowedTransitions(
  from: AttendanceState,
): readonly AttendanceState[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted plain transition. */
export function canTransition(
  from: AttendanceState,
  to: AttendanceState,
): boolean {
  return allowedTransitions(from).includes(to);
}

/** New marks and self check-ins are accepted only while the sheet is OPEN. */
export function canRecordInto(state: AttendanceState): boolean {
  return state === AttendanceState.Open;
}

/** Only an OPEN sheet may be finalized (OPEN → FINALIZED). */
export function canFinalize(state: AttendanceState): boolean {
  return canTransition(state, AttendanceState.Finalized);
}

/**
 * A finalized sheet may be corrected (→ CORRECTED); an already-corrected sheet may
 * be corrected again (it stays CORRECTED). An OPEN sheet cannot be corrected — its
 * marks are edited directly until it is finalized.
 */
export function canCorrect(state: AttendanceState): boolean {
  return (
    state === AttendanceState.Finalized || state === AttendanceState.Corrected
  );
}

/** True once the sheet is locked (finalized or corrected). */
export function isLocked(state: AttendanceState): boolean {
  return state !== AttendanceState.Open;
}
