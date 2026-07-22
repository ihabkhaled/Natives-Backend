import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { AnomalyInvalidTransitionError } from '../errors/anomaly-invalid-transition.error';
import { AnomalyNotFoundError } from '../errors/anomaly-not-found.error';
import { DataQualityScopeNotFoundError } from '../errors/data-quality-scope-not-found.error';
import { RepairNotAllowedError } from '../errors/repair-not-allowed.error';
import type { AnomalyRepository } from '../infrastructure/anomaly.repository';
import type { DetectionRepository } from '../infrastructure/detection.repository';
import type { RepairRepository } from '../infrastructure/repair.repository';
import {
  AnomalyStatus,
  AnomalyTransition,
  DataQualityRule,
  RepairStatus,
} from '../model/dataquality.enums';
import type { Anomaly, Repair } from '../model/dataquality.types';
import { AnomalyQueryService } from './anomaly-query.service';
import { DataQualityLookupService } from './dataquality-lookup.service';
import { RepairAnomalyUseCase } from './repair-anomaly.use-case';
import { ScanUseCase } from './scan.use-case';
import { TransitionAnomalyUseCase } from './transition-anomaly.use-case';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
let counter = 0;
const IDS: IdGeneratorPort = {
  generate: () => {
    counter += 1;
    return `generated-${counter}`;
  },
};
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'admin@example.test',
  roles: [],
};

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    anomalyId: 'a-1',
    teamId: 'team-1',
    ruleKey: DataQualityRule.JerseyConflict,
    ruleVersion: 'dq-v1',
    severity: 'warning' as Anomaly['severity'],
    resourceType: 'reservation' as Anomaly['resourceType'],
    resourceRef: 'ref-1',
    fingerprint: 'fp',
    occurrenceCount: 1,
    status: AnomalyStatus.Open,
    ownerUserId: null,
    resolution: null,
    suppressedUntil: null,
    recordVersion: 1,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    resolvedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function repair(overrides: Partial<Repair> = {}): Repair {
  return {
    repairId: 'rep-1',
    teamId: 'team-1',
    anomalyId: 'a-1',
    repairKind: 'release_jersey' as Repair['repairKind'],
    status: RepairStatus.Previewed,
    impactCount: 1,
    impactSummary: 'summary',
    rollbackRef: null,
    recordVersion: 1,
    requestedBy: 'user-1',
    appliedAt: null,
    rolledBackAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

function anomalyRepo(
  overrides: Record<string, unknown> = {},
): AnomalyRepository {
  return {
    upsert: vi.fn().mockResolvedValue(anomaly()),
    findForWrite: vi.fn().mockResolvedValue(anomaly()),
    applyStatusChange: vi
      .fn()
      .mockResolvedValue(anomaly({ status: AnomalyStatus.Acknowledged })),
    listForScope: vi.fn().mockResolvedValue([anomaly()]),
    countForScope: vi.fn().mockResolvedValue(1),
    activeTeamExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as AnomalyRepository;
}

function detectionRepo(
  overrides: Record<string, unknown> = {},
): DetectionRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    detectJerseyConflicts: vi.fn().mockResolvedValue([
      {
        ruleKey: DataQualityRule.JerseyConflict,
        resourceType: 'reservation',
        resourceRef: 'r-1',
      },
    ]),
    detectOrphanPoints: vi.fn().mockResolvedValue([]),
    detectStaleProjections: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as DetectionRepository;
}

function repairRepo(overrides: Record<string, unknown> = {}): RepairRepository {
  return {
    insert: vi.fn().mockResolvedValue(repair()),
    findForWrite: vi.fn().mockResolvedValue(repair()),
    findLatestForAnomaly: vi
      .fn()
      .mockResolvedValue(repair({ status: RepairStatus.Applied })),
    applyStatusChange: vi
      .fn()
      .mockResolvedValue(repair({ status: RepairStatus.Applied })),
    ...overrides,
  };
}

function lookup(anomalies = anomalyRepo()): DataQualityLookupService {
  return new DataQualityLookupService(anomalies);
}

describe('AnomalyQueryService', () => {
  it('returns a bounded page and hides a foreign anomaly', async () => {
    const service = new AnomalyQueryService(UOW, anomalyRepo(), lookup());
    expect(
      (
        await service.listForScope(
          'team-1',
          { ruleKey: null, severity: null, status: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    const missing = new AnomalyQueryService(
      UOW,
      anomalyRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
      lookup(anomalyRepo({ findForWrite: vi.fn().mockResolvedValue(null) })),
    );
    await expect(missing.getById('team-1', 'a-9')).rejects.toBeInstanceOf(
      AnomalyNotFoundError,
    );
  });
});

describe('ScanUseCase', () => {
  it('detects, folds findings, and audits the scan', async () => {
    const anomalies = anomalyRepo();
    const audit = auditStub();
    const useCase = new ScanUseCase(
      UOW,
      CLOCK,
      IDS,
      detectionRepo(),
      anomalies,
      audit,
    );
    const report = await useCase.execute(ACTOR, 'team-1', { rules: null });
    expect(report.detected).toBe(1);
    expect(report.alertable).toBe(1);
    expect(anomalies.upsert).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('hides an inactive team scope', async () => {
    const useCase = new ScanUseCase(
      UOW,
      CLOCK,
      IDS,
      detectionRepo({ activeTeamExists: vi.fn().mockResolvedValue(false) }),
      anomalyRepo(),
      auditStub(),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', { rules: null }),
    ).rejects.toBeInstanceOf(DataQualityScopeNotFoundError);
  });
});

describe('TransitionAnomalyUseCase', () => {
  function build(anomalies = anomalyRepo()) {
    return new TransitionAnomalyUseCase(
      UOW,
      CLOCK,
      lookup(anomalies),
      anomalies,
      auditStub(),
    );
  }

  it('acknowledges an open anomaly', async () => {
    expect(
      (
        await build().execute(ACTOR, 'team-1', 'a-1', {
          transition: AnomalyTransition.Acknowledge,
          resolution: null,
          expectedRecordVersion: 1,
        })
      ).status,
    ).toBe(AnomalyStatus.Acknowledged);
  });

  it('refuses an illegal transition', async () => {
    const anomalies = anomalyRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(anomaly({ status: AnomalyStatus.Open })),
    });
    await expect(
      build(anomalies).execute(ACTOR, 'team-1', 'a-1', {
        transition: AnomalyTransition.Reopen,
        resolution: null,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(AnomalyInvalidTransitionError);
  });
});

describe('RepairAnomalyUseCase', () => {
  function build(anomalies = anomalyRepo(), repairs = repairRepo()) {
    return new RepairAnomalyUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(anomalies),
      anomalies,
      repairs,
      auditStub(),
    );
  }

  it('previews a repair for a repairable anomaly', async () => {
    const preview = await build().preview('team-1', 'a-1');
    expect(preview.repairKind).toBe('release_jersey');
    expect(preview.reversible).toBe(true);
  });

  it('refuses a preview for an unsupported rule', async () => {
    const anomalies = anomalyRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(
          anomaly({ ruleKey: DataQualityRule.AssessmentOutOfScale }),
        ),
    });
    await expect(
      build(anomalies).preview('team-1', 'a-1'),
    ).rejects.toBeInstanceOf(RepairNotAllowedError);
  });

  it('applies a repair and resolves the anomaly', async () => {
    const anomalies = anomalyRepo();
    const repairs = repairRepo();
    const applied = await build(anomalies, repairs).apply(
      ACTOR,
      'team-1',
      'a-1',
    );
    expect(applied.status).toBe(RepairStatus.Applied);
    expect(repairs.insert).toHaveBeenCalledTimes(1);
    expect(anomalies.applyStatusChange).toHaveBeenCalledTimes(1);
  });

  it('rolls back a reversible applied repair', async () => {
    const repairs = repairRepo({
      findLatestForAnomaly: vi
        .fn()
        .mockResolvedValue(repair({ status: RepairStatus.Applied })),
      applyStatusChange: vi
        .fn()
        .mockResolvedValue(repair({ status: RepairStatus.RolledBack })),
    });
    expect(
      (await build(anomalyRepo(), repairs).rollback(ACTOR, 'team-1', 'a-1'))
        .status,
    ).toBe(RepairStatus.RolledBack);
  });

  it('refuses to roll back when no reversible repair exists', async () => {
    const repairs = repairRepo({
      findLatestForAnomaly: vi.fn().mockResolvedValue(null),
    });
    await expect(
      build(anomalyRepo(), repairs).rollback(ACTOR, 'team-1', 'a-1'),
    ).rejects.toBeInstanceOf(RepairNotAllowedError);
  });
});
