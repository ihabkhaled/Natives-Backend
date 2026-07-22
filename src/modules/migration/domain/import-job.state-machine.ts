import { ImportStatus } from '../model/migration.enums';

/**
 * The import-job state machine (UN-702). Pure and total.
 *
 *   staged → validated → committed → reversed
 *   staged/validated → failed
 *
 * A DRY-RUN job never leaves `staged`/`validated` — it writes nothing. Commit is
 * a distinct, guarded step, and a committed job can be REVERSED (a compensating
 * job), so an import is never an irreversible one-way door. Every path ends in a
 * terminal state.
 */
const ALLOWED: ReadonlyMap<ImportStatus, readonly ImportStatus[]> = new Map([
  [
    ImportStatus.Staged,
    [ImportStatus.Validated, ImportStatus.Committed, ImportStatus.Failed],
  ],
  [ImportStatus.Validated, [ImportStatus.Committed, ImportStatus.Failed]],
  [ImportStatus.Committed, [ImportStatus.Reversed]],
  [ImportStatus.Failed, []],
  [ImportStatus.Reversed, []],
]);

export function canTransitionImport(
  from: ImportStatus,
  to: ImportStatus,
): boolean {
  return (ALLOWED.get(from) ?? []).includes(to);
}

/** Whether a job may be committed (a staged/validated, non-dry-run job). */
export function isCommittable(status: ImportStatus, dryRun: boolean): boolean {
  if (dryRun) {
    return false;
  }
  return status === ImportStatus.Staged || status === ImportStatus.Validated;
}

/** Whether a committed job may be reversed. */
export function isReversible(status: ImportStatus): boolean {
  return status === ImportStatus.Committed;
}
