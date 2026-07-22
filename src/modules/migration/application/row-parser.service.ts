import { Inject, Injectable } from '@nestjs/common';

import { classifyParsedRow } from '../lib/migration.builders';
import { WORKBOOK_PARSER_PORT } from '../model/migration.constants';
import type {
  ImportSourceRow,
  ParsedRow,
  WorkbookParserPort,
} from '../model/migration.types';

/**
 * Parses raw source rows into staged outcomes (UN-702). Each row's cells are
 * checked through the workbook parser adapter: a `#REF!`/`#N/A`, a
 * formula-injection cell, or an invalid date turns the row into an ERROR (never
 * a silently coerced value), a row with no usable cells is QUARANTINED for a
 * human rather than dropped, and a clean row is STAGED. Blank-vs-zero is
 * preserved because the parser returns a null value for a blank, not a zero.
 */
@Injectable()
export class RowParserService {
  constructor(
    @Inject(WORKBOOK_PARSER_PORT)
    private readonly parser: WorkbookParserPort,
  ) {}

  parse(rows: readonly ImportSourceRow[]): readonly ParsedRow[] {
    return rows.map(row => this.parseRow(row));
  }

  private parseRow(row: ImportSourceRow): ParsedRow {
    const cells = Object.values(row.cells).map(raw =>
      this.parser.parseCell(raw),
    );
    return classifyParsedRow(row.rowRef, cells);
  }
}
