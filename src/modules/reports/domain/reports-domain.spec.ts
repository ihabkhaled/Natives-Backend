import { describe, expect, it } from 'vitest';

import { ReportStatus } from '../model/reports.enums';
import {
  canRetry,
  canTransitionJob,
  isDownloadable,
  isExpired,
} from './report-job.state-machine';
import {
  isFormulaCell,
  neutralizeCell,
  sanitizeRow,
  sanitizeRows,
} from './report-safety.policy';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const LATER = new Date('2025-03-01T00:10:00.000Z');
const PAST = new Date('2025-02-01T00:00:00.000Z');

describe('report safety policy', () => {
  it('neutralizes formula-leading cells only', () => {
    expect(neutralizeCell('=SUM(A1)')).toBe(`'=SUM(A1)`);
    expect(neutralizeCell('+1')).toBe(`'+1`);
    expect(neutralizeCell('@cmd')).toBe(`'@cmd`);
    expect(neutralizeCell('Ali')).toBe('Ali');
    expect(neutralizeCell('')).toBe('');
  });

  it('detects a formula cell', () => {
    expect(isFormulaCell('-2+3')).toBe(true);
    expect(isFormulaCell('safe')).toBe(false);
    expect(isFormulaCell('')).toBe(false);
  });

  it('sanitizes a row to the schema, dropping off-schema fields', () => {
    const sanitized = sanitizeRow({ name: '=EVIL()', extra: 'x', kept: 'ok' }, [
      'name',
      'kept',
    ]);
    expect(sanitized).toEqual({ name: `'=EVIL()`, kept: 'ok' });
    expect(sanitized).not.toHaveProperty('extra');
    expect(sanitizeRows([{ name: '+1' }], ['name'])[0]?.name).toBe(`'+1`);
  });

  it('fills a missing schema column with an empty string', () => {
    expect(sanitizeRow({}, ['name']).name).toBe('');
  });
});

describe('report job state machine', () => {
  it('walks the async lifecycle and refuses illegal moves', () => {
    expect(canTransitionJob(ReportStatus.Queued, ReportStatus.Running)).toBe(
      true,
    );
    expect(canTransitionJob(ReportStatus.Running, ReportStatus.Completed)).toBe(
      true,
    );
    expect(canTransitionJob(ReportStatus.Failed, ReportStatus.Running)).toBe(
      true,
    );
    expect(canTransitionJob(ReportStatus.Completed, ReportStatus.Expired)).toBe(
      true,
    );
    expect(canTransitionJob(ReportStatus.Expired, ReportStatus.Running)).toBe(
      false,
    );
  });

  it('allows a download only while completed and unexpired', () => {
    expect(isDownloadable(ReportStatus.Completed, LATER, NOW)).toBe(true);
    expect(isDownloadable(ReportStatus.Completed, PAST, NOW)).toBe(false);
    expect(isDownloadable(ReportStatus.Running, LATER, NOW)).toBe(false);
    expect(isExpired(ReportStatus.Completed, PAST, NOW)).toBe(true);
    expect(isExpired(ReportStatus.Running, PAST, NOW)).toBe(false);
  });

  it('allows a retry only for a failed job with remaining attempts', () => {
    expect(canRetry(ReportStatus.Failed, 0)).toBe(true);
    expect(canRetry(ReportStatus.Failed, 3)).toBe(false);
    expect(canRetry(ReportStatus.Completed, 0)).toBe(false);
  });
});
