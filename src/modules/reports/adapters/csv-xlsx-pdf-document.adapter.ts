import { Injectable } from '@nestjs/common';

import { neutralizeCell, sanitizeRows } from '../domain/report-safety.policy';
import { ReportFormat } from '../model/reports.enums';
import type {
  RenderedReport,
  RenderRequest,
  ReportDocumentPort,
  ReportRow,
} from '../model/reports.types';

/**
 * Document-rendering adapter (UN-701). Stands in for the CSV/XLSX/PDF document
 * libraries behind the app-owned `ReportDocumentPort`, so business code never
 * touches a vendor SDK. It sanitizes every VALUE against formula injection and
 * strips any field outside the report schema before rendering, and returns the
 * artifact as base64 bytes with its row count. Swapping in a real library (e.g.
 * exceljs, pdfkit) touches only this file.
 */
@Injectable()
export class CsvXlsxPdfDocumentAdapter implements ReportDocumentPort {
  render(request: RenderRequest): RenderedReport {
    const rows = sanitizeRows(request.rows, request.columns);
    const body = this.renderBody(request, rows);
    return {
      format: request.format,
      content: Buffer.from(body, 'utf8').toString('base64'),
      rowCount: rows.length,
    };
  }

  private renderBody(
    request: RenderRequest,
    rows: readonly ReportRow[],
  ): string {
    if (request.format === ReportFormat.Pdf) {
      return this.renderPdf(request, rows);
    }
    return this.renderDelimited(request, rows);
  }

  /** CSV and XLSX share the delimited representation in this adapter. */
  private renderDelimited(
    request: RenderRequest,
    rows: readonly ReportRow[],
  ): string {
    const header = request.columns.map(column => this.quote(column)).join(',');
    const lines = rows.map(row => {
      const cells = new Map(Object.entries(row));
      return request.columns
        .map(column => this.quote(cells.get(column) ?? ''))
        .join(',');
    });
    return [header, ...lines].join('\n');
  }

  private renderPdf(
    request: RenderRequest,
    rows: readonly ReportRow[],
  ): string {
    const header = `${request.title}\n${request.columns.join(' | ')}`;
    const lines = rows.map(row => {
      const cells = new Map(Object.entries(row));
      return request.columns.map(column => cells.get(column) ?? '').join(' | ');
    });
    return [header, ...lines].join('\n');
  }

  private quote(value: string): string {
    const safe = neutralizeCell(value).replaceAll('"', '""');
    return `"${safe}"`;
  }
}
