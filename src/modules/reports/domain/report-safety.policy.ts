import {
  FORMULA_ESCAPE_PREFIX,
  FORMULA_INJECTION_PREFIXES,
} from '../model/reports.constants';
import type { ReportRow } from '../model/reports.types';

/**
 * Pure CSV/XLSX safety rules (UN-701).
 *
 * A spreadsheet cell that begins with `=`, `+`, `-`, `@`, a tab, or a carriage
 * return is a FORMULA to Excel/Sheets, so an attacker-controlled value like
 * `=HYPERLINK(...)` runs on open. Every exported cell is neutralized by
 * prefixing a single quote, which the spreadsheet strips on display but never
 * executes. The rule is applied to VALUES only — never to a controlled column
 * header we generate ourselves.
 */
export function neutralizeCell(value: string): string {
  if (value.length === 0) {
    return value;
  }
  const first = value.charAt(0);
  if (FORMULA_INJECTION_PREFIXES.includes(first)) {
    return `${FORMULA_ESCAPE_PREFIX}${value}`;
  }
  return value;
}

/** Whether a raw cell would be interpreted as a formula. */
export function isFormulaCell(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  return FORMULA_INJECTION_PREFIXES.includes(value.charAt(0));
}

/**
 * Neutralize every value of a row and strip any field outside the report's
 * schema, so a report can never carry a column the template did not define.
 */
export function sanitizeRow(
  row: ReportRow,
  columns: readonly string[],
): ReportRow {
  return Object.fromEntries(
    columns.map(column => [
      column,
      neutralizeCell(new Map(Object.entries(row)).get(column) ?? ''),
    ]),
  );
}

export function sanitizeRows(
  rows: readonly ReportRow[],
  columns: readonly string[],
): readonly ReportRow[] {
  return rows.map(row => sanitizeRow(row, columns));
}
