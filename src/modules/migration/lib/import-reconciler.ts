import { RowOutcome } from '../model/migration.enums';
import type {
  ImportReconciliationSummary,
  ParsedRow,
} from '../model/migration.types';

/**
 * Reconciliation of an import run (UN-702).
 *
 * Every received row leaves exactly one outcome, so staged + committed + skipped
 * + error + quarantined always equals received. A quarantined row is REPORTED,
 * never dropped: an unresolved alias or an ambiguous row is evidence a human is
 * needed, not a licence to discard data.
 */
export function reconcile(
  rows: readonly ParsedRow[],
): ImportReconciliationSummary {
  return {
    received: rows.length,
    staged: count(rows, RowOutcome.Staged),
    committed: count(rows, RowOutcome.Committed),
    skippedDuplicate: count(rows, RowOutcome.SkippedDuplicate),
    error: count(rows, RowOutcome.Error),
    quarantined: count(rows, RowOutcome.Quarantined),
  };
}

export function count(rows: readonly ParsedRow[], outcome: RowOutcome): number {
  return rows.filter(row => row.outcome === outcome).length;
}

/** Whether every received row is accounted for exactly once. */
export function isBalanced(summary: ImportReconciliationSummary): boolean {
  const accounted =
    summary.staged +
    summary.committed +
    summary.skippedDuplicate +
    summary.error +
    summary.quarantined;
  return accounted === summary.received;
}
