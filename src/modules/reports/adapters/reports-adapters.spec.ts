import type { AppConfigService } from '@config/app-config.service';
import { describe, expect, it } from 'vitest';

import { ReportFormat, ReportTemplate } from '../model/reports.enums';
import { CsvXlsxPdfDocumentAdapter } from './csv-xlsx-pdf-document.adapter';
import { SignedReportDownloadAdapter } from './signed-report-download.adapter';

const NOW = new Date('2025-03-01T00:00:00.000Z');

describe('CsvXlsxPdfDocumentAdapter', () => {
  const adapter = new CsvXlsxPdfDocumentAdapter();

  it('renders a delimited report with a neutralized formula cell', () => {
    const rendered = adapter.render({
      template: ReportTemplate.Attendance,
      format: ReportFormat.Csv,
      title: 'Attendance',
      columns: ['name', 'value'],
      rows: [{ name: '=EVIL()', value: '5', extra: 'dropped' }],
    });
    expect(rendered.format).toBe(ReportFormat.Csv);
    expect(rendered.rowCount).toBe(1);
    const decoded = Buffer.from(rendered.content, 'base64').toString('utf8');
    expect(decoded).toContain(`'=EVIL()`);
    expect(decoded).not.toContain('dropped');
  });

  it('renders a PDF presentation', () => {
    const rendered = adapter.render({
      template: ReportTemplate.MatchSheet,
      format: ReportFormat.Pdf,
      title: 'Match Sheet',
      columns: ['name'],
      rows: [{ name: 'Ali' }],
    });
    expect(rendered.format).toBe(ReportFormat.Pdf);
    expect(Buffer.from(rendered.content, 'base64').toString('utf8')).toContain(
      'Match Sheet',
    );
  });
});

describe('SignedReportDownloadAdapter', () => {
  function adapter(): SignedReportDownloadAdapter {
    return new SignedReportDownloadAdapter({
      security: { jwtSecret: 'test-secret' },
    } as unknown as AppConfigService);
  }

  it('mints an expiring signed URL bound to the checksum', () => {
    const ticket = adapter().createDownloadTicket({
      storageReference: 'reports/team-1/job-1.csv',
      checksum: 'sum',
      now: NOW,
    });
    expect(ticket.url).toContain('checksum=sum');
    expect(ticket.url).toContain('signature=');
    expect(ticket.expiresAt.getTime()).toBe(NOW.getTime() + 900_000);
    expect(ticket.checksum).toBe('sum');
  });

  it('produces a different signature for a different reference', () => {
    const first = adapter().createDownloadTicket({
      storageReference: 'a',
      checksum: 'sum',
      now: NOW,
    });
    const second = adapter().createDownloadTicket({
      storageReference: 'b',
      checksum: 'sum',
      now: NOW,
    });
    expect(first.url).not.toBe(second.url);
  });
});
