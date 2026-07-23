import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  ReportFormat,
  ReportPrivacyClass,
  ReportStatus,
  ReportTemplate,
} from '../model/reports.enums';
import type { ReportJobRow } from '../model/reports.rows';
import { ReportDataRepository } from './report-data.repository';
import { ReportJobRepository } from './report-job.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const ROW: ReportJobRow = {
  id: 'job-1',
  team_id: 'team-1',
  season_id: null,
  template: 'attendance',
  format: 'csv',
  privacy_class: 'team',
  parameters: {},
  request_hash: 'hash',
  status: 'queued',
  progress: 0,
  retry_count: 0,
  calculation_version: 'reports-v1',
  snapshot_at: NOW,
  storage_reference: null,
  checksum: null,
  row_count: null,
  failure_reason: null,
  expires_at: NOW,
  record_version: 1,
  requested_by: 'user-1',
  started_at: null,
  completed_at: null,
  failed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

function scopeReturning(...results: unknown[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  run.mockResolvedValue([]);
  return { scope: { run }, run };
}

describe('ReportJobRepository', () => {
  const repository = new ReportJobRepository();
  const newJob = {
    id: 'job-1',
    teamId: 'team-1',
    seasonId: null,
    template: ReportTemplate.Attendance,
    format: ReportFormat.Csv,
    privacyClass: ReportPrivacyClass.Team,
    parameters: {},
    requestHash: 'hash',
    calculationVersion: 'reports-v1',
    snapshotAt: NOW,
    expiresAt: NOW,
    requestedBy: 'user-1',
    now: NOW,
  };

  it('inserts and resolves a job, and finds by request hash', async () => {
    const inserted = scopeReturning([ROW]);
    expect((await repository.insert(inserted.scope, newJob)).status).toBe(
      ReportStatus.Queued,
    );
    const byHash = scopeReturning([ROW]);
    expect(
      (await repository.findByRequestHash(byHash.scope, 'team-1', 'hash'))
        ?.jobId,
    ).toBe('job-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findByRequestHash(missing.scope, 'team-1', 'none'),
    ).toBeNull();
  });

  it('throws when a job write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newJob)).rejects.toThrow(
      /report job write/u,
    );
  });

  it('marks running, completes, and increments a retry under guards', async () => {
    const running = scopeReturning([{ ...ROW, status: 'running' }]);
    expect(
      (await repository.markRunning(running.scope, 'team-1', 'job-1', NOW))
        ?.status,
    ).toBe(ReportStatus.Running);
    expect(String(running.run.mock.calls[0]?.[0])).toContain(
      `IN ('queued', 'failed')`,
    );
    const completed = scopeReturning([
      { ...ROW, status: 'completed', checksum: 'sum' },
    ]);
    expect(
      (
        await repository.complete(completed.scope, {
          id: 'job-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          storageReference: 'ref',
          checksum: 'sum',
          rowCount: 3,
          now: NOW,
        })
      )?.status,
    ).toBe(ReportStatus.Completed);
    const retried = scopeReturning([{ ...ROW, status: 'running' }]);
    expect(
      (await repository.incrementRetry(retried.scope, 'team-1', 'job-1', NOW))
        ?.retryCount,
    ).toBe(0);
    const stale = scopeReturning([]);
    expect(
      await repository.complete(stale.scope, {
        id: 'job-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        storageReference: 'ref',
        checksum: 'sum',
        rowCount: 3,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('bounds the list, counts, and probes team activity', async () => {
    const filter = {
      template: null,
      status: null,
      seasonId: null,
      requestedBy: null,
    };
    const list = scopeReturning([ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const listSql = String(list.run.mock.calls[0]?.[0]);
    expect(listSql).toContain('($4::uuid IS NULL OR "season_id" = $4)');
    expect(listSql).toContain('($5::uuid IS NULL OR "requested_by" = $5)');
    const count = scopeReturning([{ count: 2 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      2,
    );
    expect(String(count.run.mock.calls[0]?.[0])).toContain(
      '($5::uuid IS NULL OR "requested_by" = $5)',
    );
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
  });
});

describe('ReportDataRepository', () => {
  const repository = new ReportDataRepository();

  it('reads attendance, leaderboard, and roster rows over the full roster', async () => {
    const attendance = scopeReturning([
      { membership_id: 'm-1', attended: 4, total: 5 },
    ]);
    const attendanceRows = await repository.attendanceRows(
      attendance.scope,
      'team-1',
      null,
    );
    expect(attendanceRows[0]).toEqual({
      membershipId: 'm-1',
      attended: '4',
      total: '5',
    });
    expect(String(attendance.run.mock.calls[0]?.[0])).toContain('LEFT JOIN');
    const leaderboard = scopeReturning([{ membership_id: 'm-1', total: 12 }]);
    expect(
      (await repository.leaderboardRows(leaderboard.scope, 'team-1', null))[0]
        ?.points,
    ).toBe('12');
    const roster = scopeReturning([
      { membership_id: 'm-1', status: 'active', jersey_number: 7 },
    ]);
    const rosterRows = await repository.rosterRows(roster.scope, 'team-1');
    expect(rosterRows[0]?.jerseyNumber).toBe('7');
    const noJersey = scopeReturning([
      { membership_id: 'm-2', status: 'active', jersey_number: null },
    ]);
    expect(
      (await repository.rosterRows(noJersey.scope, 'team-1'))[0]?.jerseyNumber,
    ).toBe('');
  });
});
