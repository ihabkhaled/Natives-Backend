import { Injectable } from '@nestjs/common';

import {
  FORMULA_PREFIXES,
  SPREADSHEET_ERROR_TOKENS,
} from '../model/migration.constants';
import { CellIssue } from '../model/migration.enums';
import type { ParsedCell, WorkbookParserPort } from '../model/migration.types';

/**
 * Workbook-parsing adapter (UN-702). Owns the XLSX parsing behind the app-owned
 * `WorkbookParserPort` so business code never touches a spreadsheet vendor SDK.
 *
 * A cached formula RESULT is untrusted: a `#REF!`/`#N/A` token becomes a typed
 * issue rather than a value, a would-be formula-injection cell is flagged, a
 * blank is distinguished from a real zero, and Excel serial dates are converted
 * explicitly. Swapping in a real library (e.g. exceljs) touches only this file.
 */
@Injectable()
export class XlsxWorkbookParserAdapter implements WorkbookParserPort {
  private static readonly EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  private static readonly MS_PER_DAY = 86_400_000;

  parseCell(raw: string): ParsedCell {
    const trimmed = raw.trim();
    if (this.isSpreadsheetError(trimmed)) {
      return this.issue(raw, CellIssue.BrokenReference);
    }
    if (trimmed === '#N/A') {
      return this.issue(raw, CellIssue.NotAvailable);
    }
    if (this.isFormula(trimmed)) {
      return this.issue(raw, CellIssue.FormulaInjection);
    }
    if (trimmed.length === 0) {
      return { raw, value: null, issue: null };
    }
    return { raw, value: trimmed, issue: null };
  }

  /** Convert an Excel serial or an ISO date to an ISO calendar day, or null. */
  parseSerialDate(raw: string): string | null {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
      return Number.isNaN(Date.parse(`${trimmed}T00:00:00.000Z`))
        ? null
        : trimmed;
    }
    const serial = Number(trimmed);
    if (!Number.isFinite(serial) || serial <= 0) {
      return null;
    }
    const ms =
      XlsxWorkbookParserAdapter.EXCEL_EPOCH_MS +
      serial * XlsxWorkbookParserAdapter.MS_PER_DAY;
    return new Date(ms).toISOString().slice(0, 10);
  }

  private isSpreadsheetError(value: string): boolean {
    return SPREADSHEET_ERROR_TOKENS.includes(value) && value !== '#N/A';
  }

  private isFormula(value: string): boolean {
    if (value.length === 0) {
      return false;
    }
    return FORMULA_PREFIXES.includes(value.charAt(0));
  }

  private issue(raw: string, issue: CellIssue): ParsedCell {
    return { raw, value: null, issue };
  }
}
