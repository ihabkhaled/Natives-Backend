import { describe, expect, it } from 'vitest';

import { CellIssue } from '../model/migration.enums';
import { XlsxWorkbookParserAdapter } from './xlsx-workbook-parser.adapter';

describe('XlsxWorkbookParserAdapter', () => {
  const parser = new XlsxWorkbookParserAdapter();

  it('treats broken references and N/A as untrusted', () => {
    expect(parser.parseCell('#REF!').issue).toBe(CellIssue.BrokenReference);
    expect(parser.parseCell('#N/A').issue).toBe(CellIssue.NotAvailable);
  });

  it('flags a formula-injection cell', () => {
    expect(parser.parseCell('=HYPERLINK("x")').issue).toBe(
      CellIssue.FormulaInjection,
    );
    expect(parser.parseCell('+1').issue).toBe(CellIssue.FormulaInjection);
  });

  it('distinguishes a blank from a real value', () => {
    expect(parser.parseCell('   ').value).toBeNull();
    expect(parser.parseCell('   ').issue).toBeNull();
    expect(parser.parseCell(' Ali ').value).toBe('Ali');
  });

  it('converts an Excel serial date and an ISO date', () => {
    expect(parser.parseSerialDate('45292')).toBe('2024-01-01');
    expect(parser.parseSerialDate('2024-05-18')).toBe('2024-05-18');
    expect(parser.parseSerialDate('not-a-date')).toBeNull();
    expect(parser.parseSerialDate('2024-13-40')).toBeNull();
  });
});
