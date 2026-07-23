import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { ReportExpiredError } from '../errors/report-expired.error';
import { ReportJobNotFoundError } from '../errors/report-job-not-found.error';
import { ReportNotReadyError } from '../errors/report-not-ready.error';
import { ReportRetryNotAllowedError } from '../errors/report-retry-not-allowed.error';
import { ReportScopeNotFoundError } from '../errors/report-scope-not-found.error';
import type { ReportDataRepository } from '../infrastructure/report-data.repository';
import type { ReportJobRepository } from '../infrastructure/report-job.repository';
import {
  ReportFormat,
  ReportPrivacyClass,
  ReportStatus,
  ReportTemplate,
} from '../model/reports.enums';
import type {
  DownloadTicket,
  RenderedReport,
  ReportDocumentPort,
  ReportDownloadPort,
  ReportJob,
} from '../model/reports.types';
import { GenerateReportUseCase } from './generate-report.use-case';
import { ReportDatasetService } from './report-dataset.service';
import { ReportDownloadService } from './report-download.service';
import { ReportQueryService } from './report-query.service';
import { RetryReportUseCase } from './retry-report.use-case';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const FUTURE = new Date('2025-03-08T00:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
const IDS: IdGeneratorPort = { generate: () => 'generated-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'admin@example.test',
  roles: [],
};

function job(overrides: Partial<ReportJob> = {}): ReportJob {
  return {
    jobId: 'job-1',
    teamId: 'team-1',
    seasonId: null,
    template: ReportTemplate.Attendance,
    format: ReportFormat.Csv,
    privacyClass: ReportPrivacyClass.Team,
    parameters: {},
    requestHash: 'hash',
    status: ReportStatus.Queued,
    progress: 0,
    retryCount: 0,
    calculationVersion: 'reports-v1',
    snapshotAt: NOW,
    storageReference: null,
    checksum: null,
    rowCount: null,
    failureReason: null,
    expiresAt: FUTURE,
    recordVersion: 1,
    requestedBy: 'user-1',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const RENDERED: RenderedReport = {
  format: ReportFormat.Csv,
  content: 'base64content',
  rowCount: 3,
};

function documentPort(): ReportDocumentPort {
  return { render: vi.fn().mockReturnValue(RENDERED) };
}

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

function jobRepo(overrides: Record<string, unknown> = {}): ReportJobRepository {
  return {
    insert: vi.fn().mockResolvedValue(job()),
    findForWrite: vi.fn().mockResolvedValue(job()),
    findByRequestHash: vi.fn().mockResolvedValue(null),
    markRunning: vi
      .fn()
      .mockResolvedValue(job({ status: ReportStatus.Running })),
    complete: vi.fn().mockResolvedValue(
      job({
        status: ReportStatus.Completed,
        storageReference: 'ref',
        checksum: 'sum',
      }),
    ),
    incrementRetry: vi
      .fn()
      .mockResolvedValue(job({ status: ReportStatus.Running, retryCount: 1 })),
    listForScope: vi.fn().mockResolvedValue([job()]),
    countForScope: vi.fn().mockResolvedValue(1),
    activeTeamExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function dataRepo(): ReportDataRepository {
  return {
    attendanceRows: vi.fn().mockResolvedValue([{ membershipId: 'm-1' }]),
    leaderboardRows: vi.fn().mockResolvedValue([]),
    rosterRows: vi.fn().mockResolvedValue([{ membershipId: 'm-1' }]),
  };
}

describe('ReportQueryService', () => {
  it('returns a bounded page and hides a foreign job', async () => {
    const service = new ReportQueryService(UOW, jobRepo());
    expect(
      (
        await service.listForScope(
          'team-1',
          { template: null, status: null, seasonId: null, requestedBy: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    const missing = new ReportQueryService(
      UOW,
      jobRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
    );
    await expect(missing.getById('team-1', 'job-9')).rejects.toBeInstanceOf(
      ReportJobNotFoundError,
    );
  });
});

describe('GenerateReportUseCase', () => {
  function build(jobs = jobRepo()) {
    return {
      jobs,
      useCase: new GenerateReportUseCase(
        UOW,
        CLOCK,
        IDS,
        documentPort(),
        jobs,
        new ReportDatasetService(dataRepo()),
        auditStub(),
      ),
    };
  }

  const command = {
    request: {
      seasonId: null,
      template: ReportTemplate.Attendance,
      format: ReportFormat.Csv,
      parameters: {},
    },
  };

  it('queues, renders, and completes a fresh report', async () => {
    const { useCase, jobs } = build();
    const result = await useCase.execute(ACTOR, 'team-1', command);
    expect(result.status).toBe(ReportStatus.Completed);
    expect(jobs.complete).toHaveBeenCalledTimes(1);
  });

  it('replays an identical request to the existing job', async () => {
    const existing = job({ status: ReportStatus.Completed });
    const { useCase, jobs } = build(
      jobRepo({ findByRequestHash: vi.fn().mockResolvedValue(existing) }),
    );
    const result = await useCase.execute(ACTOR, 'team-1', command);
    expect(result).toBe(existing);
    expect(jobs.insert).not.toHaveBeenCalled();
  });

  it('hides an inactive team scope', async () => {
    const { useCase } = build(
      jobRepo({ activeTeamExists: vi.fn().mockResolvedValue(false) }),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', command),
    ).rejects.toBeInstanceOf(ReportScopeNotFoundError);
  });
});

describe('RetryReportUseCase', () => {
  function build(jobs: ReportJobRepository) {
    return new RetryReportUseCase(
      UOW,
      CLOCK,
      documentPort(),
      new ReportQueryService(UOW, jobs),
      jobs,
      new ReportDatasetService(dataRepo()),
      auditStub(),
    );
  }

  it('retries a failed job to completion', async () => {
    const jobs = jobRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(job({ status: ReportStatus.Failed })),
    });
    expect((await build(jobs).execute(ACTOR, 'team-1', 'job-1')).status).toBe(
      ReportStatus.Completed,
    );
  });

  it('refuses to retry a completed job', async () => {
    const jobs = jobRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(job({ status: ReportStatus.Completed })),
    });
    await expect(
      build(jobs).execute(ACTOR, 'team-1', 'job-1'),
    ).rejects.toBeInstanceOf(ReportRetryNotAllowedError);
  });

  it('refuses a failed job with exhausted retries', async () => {
    const jobs = jobRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(job({ status: ReportStatus.Failed, retryCount: 3 })),
    });
    await expect(
      build(jobs).execute(ACTOR, 'team-1', 'job-1'),
    ).rejects.toBeInstanceOf(ReportRetryNotAllowedError);
  });
});

describe('ReportDownloadService', () => {
  const download: ReportDownloadPort = {
    createDownloadTicket: (): DownloadTicket => ({
      url: 'https://reports.example/x',
      expiresAt: FUTURE,
      checksum: 'sum',
    }),
  };

  function build(jobs: ReportJobRepository) {
    return new ReportDownloadService(
      UOW,
      CLOCK,
      download,
      new ReportQueryService(UOW, jobs),
      auditStub(),
    );
  }

  it('mints a signed ticket for a completed job', async () => {
    const jobs = jobRepo({
      findForWrite: vi.fn().mockResolvedValue(
        job({
          status: ReportStatus.Completed,
          storageReference: 'ref',
          checksum: 'sum',
        }),
      ),
    });
    expect(
      (await build(jobs).createTicket(ACTOR, 'team-1', 'job-1')).url,
    ).toContain('https://');
  });

  it('refuses a not-completed job', async () => {
    const jobs = jobRepo({
      findForWrite: vi.fn().mockResolvedValue(job()),
    });
    await expect(
      build(jobs).createTicket(ACTOR, 'team-1', 'job-1'),
    ).rejects.toBeInstanceOf(ReportNotReadyError);
  });

  it('refuses an expired download', async () => {
    const jobs = jobRepo({
      findForWrite: vi.fn().mockResolvedValue(
        job({
          status: ReportStatus.Completed,
          storageReference: 'ref',
          checksum: 'sum',
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
      ),
    });
    await expect(
      build(jobs).createTicket(ACTOR, 'team-1', 'job-1'),
    ).rejects.toBeInstanceOf(ReportExpiredError);
  });
});

describe('ReportDatasetService', () => {
  it('resolves columns, title, and dispatches rows by template', async () => {
    const service = new ReportDatasetService(dataRepo());
    expect(service.columnsFor(ReportTemplate.Attendance)).toContain('attended');
    expect(service.columnsFor(ReportTemplate.MatchSheet)).toContain(
      'membershipId',
    );
    expect(service.titleFor(ReportTemplate.Attendance)).toBe('Attendance');
    expect(
      await service.rowsFor(TX, job({ template: ReportTemplate.Attendance })),
    ).toHaveLength(1);
    expect(
      await service.rowsFor(
        TX,
        job({ template: ReportTemplate.TrainingLeaderboard }),
      ),
    ).toEqual([]);
    expect(
      await service.rowsFor(TX, job({ template: ReportTemplate.MatchSheet })),
    ).toHaveLength(1);
  });
});
