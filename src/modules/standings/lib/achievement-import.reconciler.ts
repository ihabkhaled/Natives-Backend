import { AchievementImportOutcome } from '../model/standings.enums';
import type {
  AchievementImportReport,
  AchievementImportRow,
  AchievementImportRowResult,
} from '../model/standings.types';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const SPREADSHEET_ERRORS = ['#REF!', '#N/A', '#VALUE!', '#DIV/0!', '#NAME?'];

/**
 * Reconciliation and validation of an audited historical achievement import
 * (UN-506).
 *
 * A spreadsheet cell is NOT truth: a row whose title still contains a broken
 * formula result (`#REF!`, `#N/A`, …) or whose date is not a real calendar day
 * is REJECTED and reported, never coerced into a trophy. Every received row
 * leaves exactly one outcome so imported + skipped + rejected always equals
 * received.
 */
export function isImportableRow(row: AchievementImportRow): boolean {
  return hasCleanText(row.title) && isCalendarDay(row.achievedOn);
}

/** Whether a cell survived the legacy workbook without a formula error. */
export function hasCleanText(value: string): boolean {
  if (value.trim().length === 0) {
    return false;
  }
  return !SPREADSHEET_ERRORS.some(error => value.includes(error));
}

export function isCalendarDay(value: string): boolean {
  if (!ISO_DAY.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function buildAchievementImportReport(
  dryRun: boolean,
  received: number,
  rows: readonly AchievementImportRowResult[],
): AchievementImportReport {
  return {
    dryRun,
    received,
    imported: countOutcome(rows, AchievementImportOutcome.Imported),
    skippedDuplicate: countOutcome(
      rows,
      AchievementImportOutcome.SkippedDuplicate,
    ),
    rejectedInvalid: countOutcome(
      rows,
      AchievementImportOutcome.RejectedInvalid,
    ),
    rows,
  };
}

export function countOutcome(
  rows: readonly AchievementImportRowResult[],
  outcome: AchievementImportOutcome,
): number {
  return rows.filter(row => row.outcome === outcome).length;
}

export function buildAchievementRowResult(
  reference: string,
  outcome: AchievementImportOutcome,
  achievementId: string | null,
): AchievementImportRowResult {
  return { reference, outcome, achievementId };
}

/** Whether every received row was accounted for exactly once. */
export function isBalancedAchievementReport(
  report: AchievementImportReport,
): boolean {
  return (
    report.imported + report.skippedDuplicate + report.rejectedInvalid ===
    report.received
  );
}
