import { AgendaStatus } from '../model/agendas.enums';

/**
 * Pure agenda lifecycle state machine. Encodes the DRAFT → PUBLISHED → COMPLETED
 * workflow: a DRAFT agenda is fully editable (blocks/stations/groups may be added,
 * changed, reordered, or removed); PUBLISHED locks the structure so authoring edits
 * refuse, while execution/completion of blocks may still be recorded; COMPLETED is
 * the post-session review state and stays terminal. No side effects, no time, no
 * persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<AgendaStatus, readonly AgendaStatus[]> = new Map(
  [
    [AgendaStatus.Draft, [AgendaStatus.Published]],
    [AgendaStatus.Published, [AgendaStatus.Completed]],
    [AgendaStatus.Completed, []],
  ],
);

/** The set of states reachable from `from` in one transition. */
export function allowedTransitions(
  from: AgendaStatus,
): readonly AgendaStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransition(from: AgendaStatus, to: AgendaStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/** Structural authoring (add/update/remove/reorder) is allowed only while DRAFT. */
export function canEditStructure(status: AgendaStatus): boolean {
  return status === AgendaStatus.Draft;
}

/** Only a DRAFT agenda may be published (DRAFT → PUBLISHED). */
export function canPublish(status: AgendaStatus): boolean {
  return canTransition(status, AgendaStatus.Published);
}

/** Only a PUBLISHED agenda may be completed (PUBLISHED → COMPLETED). */
export function canComplete(status: AgendaStatus): boolean {
  return canTransition(status, AgendaStatus.Completed);
}

/**
 * Execution/completion of blocks is recorded once the session is under way — i.e.
 * after the agenda is published (or already completed in post-session review). A
 * DRAFT agenda has nothing to execute yet.
 */
export function canRecordExecution(status: AgendaStatus): boolean {
  return status === AgendaStatus.Published || status === AgendaStatus.Completed;
}
