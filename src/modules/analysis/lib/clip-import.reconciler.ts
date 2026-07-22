import { ClipImportOutcome } from '../model/analysis.enums';
import type {
  ClipImportReport,
  ClipImportRowResult,
} from '../model/analysis.types';

/**
 * Reconciliation of an audited analysis import (UN-505).
 *
 * Every received row leaves exactly one outcome, so imported + skipped +
 * rejected always equals received. A rejected row is REPORTED, never silently
 * dropped: an unresolvable alias or an out-of-range timestamp is evidence the
 * legacy sheet needs a human, not a reason to invent a clip.
 */
export function buildImportReport(
  dryRun: boolean,
  received: number,
  rows: readonly ClipImportRowResult[],
): ClipImportReport {
  return {
    dryRun,
    received,
    imported: countOutcome(rows, ClipImportOutcome.Imported),
    skippedDuplicate: countOutcome(rows, ClipImportOutcome.SkippedDuplicate),
    rejectedTimestamp: countOutcome(rows, ClipImportOutcome.RejectedTimestamp),
    rejectedAlias: countOutcome(rows, ClipImportOutcome.RejectedAlias),
    rows,
  };
}

export function countOutcome(
  rows: readonly ClipImportRowResult[],
  outcome: ClipImportOutcome,
): number {
  return rows.filter(row => row.outcome === outcome).length;
}

/** Whether every received row was accounted for exactly once. */
export function isBalancedReport(report: ClipImportReport): boolean {
  const accounted =
    report.imported +
    report.skippedDuplicate +
    report.rejectedTimestamp +
    report.rejectedAlias;
  return accounted === report.received;
}

export function buildRowResult(
  reference: string,
  outcome: ClipImportOutcome,
  clipId: string | null,
): ClipImportRowResult {
  return { reference, outcome, clipId };
}
