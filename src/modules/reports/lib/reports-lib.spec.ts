import { describe, expect, it } from 'vitest';

import {
  ReportFormat,
  ReportPrivacyClass,
  ReportStatus,
  ReportTemplate,
} from '../model/reports.enums';
import type { ReportJobRow } from '../model/reports.rows';
import type { ReportJob, ReportRequest } from '../model/reports.types';
import { buildJobAudit, buildNewJob, expiryOf } from './reports.builders';
import {
  defaultFormatOf,
  normalizeParameters,
  parseEnumValue,
  privacyOf,
  requestHash,
  resolveReportsPage,
  toDate,
  toNullableNumber,
  toNumber,
  toParameters,
} from './reports.helpers';
import { toReportJob } from './reports.mapper';
import { toReportListFilter, toReportRequest } from './reports-command.mapper';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const ROW: ReportJobRow = {
  id: 'job-1',
  team_id: 'team-1',
  season_id: null,
  template: 'attendance',
  format: 'csv',
  privacy_class: 'team',
  parameters: { scope: 'season' },
  request_hash: 'hash',
  status: 'queued',
  progress: '0',
  retry_count: '0',
  calculation_version: 'reports-v1',
  snapshot_at: NOW,
  storage_reference: null,
  checksum: null,
  row_count: null,
  failure_reason: null,
  expires_at: NOW,
  record_version: '1',
  requested_by: 'user-1',
  started_at: null,
  completed_at: null,
  failed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const REQUEST: ReportRequest = {
  seasonId: null,
  template: ReportTemplate.Attendance,
  format: ReportFormat.Csv,
  parameters: { scope: 'season' },
};

describe('reports helpers', () => {
  it('clamps paging and coerces driver values', () => {
    expect(resolveReportsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveReportsPage(999, 5)).toEqual({ limit: 100, offset: 5 });
    expect(toDate(NOW)).toBe(NOW);
    expect(toNumber('4')).toBe(4);
    expect(toNullableNumber(null)).toBeNull();
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'x')).toThrow(/x/u);
  });

  it('resolves template privacy and default format', () => {
    expect(privacyOf(ReportTemplate.PlayerPerformance)).toBe(
      ReportPrivacyClass.Restricted,
    );
    expect(privacyOf(ReportTemplate.MatchSheet)).toBe(
      ReportPrivacyClass.Public,
    );
    expect(defaultFormatOf(ReportTemplate.MatchSheet)).toBe(ReportFormat.Pdf);
    expect(defaultFormatOf(ReportTemplate.Attendance)).toBe(ReportFormat.Csv);
  });

  it('hashes a request stably regardless of parameter order', () => {
    const a = requestHash('team-1', {
      ...REQUEST,
      parameters: { a: '1', b: '2' },
    });
    const b = requestHash('team-1', {
      ...REQUEST,
      parameters: { b: '2', a: '1' },
    });
    expect(a).toBe(b);
    expect(requestHash('team-2', REQUEST)).not.toBe(a);
  });

  it('bounds and normalizes parameters', () => {
    expect(normalizeParameters({ a: 'x'.repeat(500) }).a).toHaveLength(200);
    expect(toParameters({ a: 3 })).toEqual({ a: '3' });
    expect(toParameters('nope')).toEqual({});
  });
});

describe('reports mapper', () => {
  it('maps a job row', () => {
    const job = toReportJob(ROW);
    expect(job.template).toBe(ReportTemplate.Attendance);
    expect(job.status).toBe(ReportStatus.Queued);
    expect(job.parameters).toEqual({ scope: 'season' });
    expect(job.checksum).toBeNull();
  });
});

describe('reports command mapper', () => {
  it('defaults format from the template and normalizes parameters', () => {
    const request = toReportRequest({ template: ReportTemplate.MatchSheet });
    expect(request.format).toBe(ReportFormat.Pdf);
    expect(request.parameters).toEqual({});
    expect(toReportListFilter({})).toEqual({
      template: null,
      status: null,
      seasonId: null,
      requestedBy: null,
    });
    expect(
      toReportListFilter({ seasonId: 'season-1', requestedBy: 'user-1' }),
    ).toEqual({
      template: null,
      status: null,
      seasonId: 'season-1',
      requestedBy: 'user-1',
    });
  });
});

describe('reports builders', () => {
  it('builds a new job with a computed expiry', () => {
    const job = buildNewJob(
      'job-1',
      'team-1',
      REQUEST,
      ReportPrivacyClass.Team,
      'hash',
      'user-1',
      NOW,
    );
    expect(job.expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(expiryOf(NOW).getTime()).toBe(job.expiresAt.getTime());
  });

  it('audits without the produced rows or parameter values', () => {
    const job: ReportJob = toReportJob(ROW);
    const audit = buildJobAudit('report.completed', 'user-1', job);
    expect(audit.diff['template']).toBe('attendance');
    expect(JSON.stringify(audit.diff)).not.toContain('season');
  });
});
