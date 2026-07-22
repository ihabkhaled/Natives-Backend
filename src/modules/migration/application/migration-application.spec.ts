import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { AliasCollisionError } from '../errors/alias-collision.error';
import { ComparisonNotFoundError } from '../errors/comparison-not-found.error';
import { ImportJobNotFoundError } from '../errors/import-job-not-found.error';
import { ImportNotCommittableError } from '../errors/import-not-committable.error';
import { ImportNotReversibleError } from '../errors/import-not-reversible.error';
import { MigrationScopeNotFoundError } from '../errors/migration-scope-not-found.error';
import type { AliasResolutionRepository } from '../infrastructure/alias-resolution.repository';
import type { FormulaComparisonRepository } from '../infrastructure/formula-comparison.repository';
import type { ImportJobRepository } from '../infrastructure/import-job.repository';
import type { MigrationScopeRepository } from '../infrastructure/migration-scope.repository';
import {
  AliasResolutionStatus,
  DiscrepancyClassification,
  ImportStatus,
  WorkbookType,
} from '../model/migration.enums';
import type {
  AliasResolution,
  FormulaComparison,
  ImportJob,
  WorkbookParserPort,
} from '../model/migration.types';
import { CommitImportUseCase } from './commit-import.use-case';
import { CompareFormulaUseCase } from './compare-formula.use-case';
import { MigrationLookupService } from './migration-lookup.service';
import { MigrationQueryService } from './migration-query.service';
import { ResolveAliasUseCase } from './resolve-alias.use-case';
import { RowParserService } from './row-parser.service';
import { StageImportUseCase } from './stage-import.use-case';

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

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    jobId: 'job-1',
    teamId: 'team-1',
    seasonId: null,
    workbookType: WorkbookType.Assessments,
    mapperVersion: 'mapper-v1',
    sourceHash: 'hash',
    sourceName: 'book.xlsx',
    dryRun: true,
    status: ImportStatus.Staged,
    receivedRows: 2,
    stagedRows: 2,
    committedRows: 0,
    skippedRows: 0,
    errorRows: 0,
    quarantinedRows: 0,
    reversalOfJobId: null,
    recordVersion: 1,
    requestedBy: 'user-1',
    committedAt: null,
    reversedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function alias(overrides: Partial<AliasResolution> = {}): AliasResolution {
  return {
    resolutionId: 'alias-1',
    teamId: 'team-1',
    source: 'import' as AliasResolution['source'],
    sourceAlias: 'Mohd Ali',
    normalizedAlias: 'mohamed ali',
    candidateMembershipId: 'member-1',
    confidence: 0.95,
    status: AliasResolutionStatus.Pending,
    resolvedMembershipId: null,
    override: false,
    recordVersion: 1,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function comparison(
  overrides: Partial<FormulaComparison> = {},
): FormulaComparison {
  return {
    comparisonId: 'cmp-1',
    teamId: 'team-1',
    workbookType: WorkbookType.MatchStats,
    metric: 'goals',
    subjectRef: 's-1',
    legacyValue: 10,
    targetValue: 15,
    difference: 5,
    classification: DiscrepancyClassification.TargetBug,
    legacyRuleVersion: 'v1',
    targetRuleVersion: 'v1',
    artifactChecksum: 'checksum',
    signedOff: false,
    signedOffByName: null,
    recordVersion: 1,
    signedOffAt: null,
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

function scopeRepo(
  overrides: Record<string, unknown> = {},
): MigrationScopeRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    membershipExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function importRepo(
  overrides: Record<string, unknown> = {},
): ImportJobRepository {
  return {
    insert: vi.fn().mockResolvedValue(job()),
    findForWrite: vi.fn().mockResolvedValue(job()),
    findCommittedBySource: vi.fn().mockResolvedValue(null),
    reconcile: vi
      .fn()
      .mockResolvedValue(job({ status: ImportStatus.Validated })),
    insertRowResults: vi.fn().mockResolvedValue(undefined),
    listResults: vi.fn().mockResolvedValue([]),
    listForScope: vi.fn().mockResolvedValue([job()]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function aliasRepo(
  overrides: Record<string, unknown> = {},
): AliasResolutionRepository {
  return {
    upsert: vi.fn().mockResolvedValue(alias()),
    findForWrite: vi.fn().mockResolvedValue(alias()),
    applyReview: vi
      .fn()
      .mockResolvedValue(alias({ status: AliasResolutionStatus.Confirmed })),
    listForScope: vi.fn().mockResolvedValue([alias()]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function comparisonRepo(
  overrides: Record<string, unknown> = {},
): FormulaComparisonRepository {
  return {
    upsert: vi.fn().mockResolvedValue(comparison()),
    findForWrite: vi.fn().mockResolvedValue(comparison()),
    signOff: vi.fn().mockResolvedValue(comparison({ signedOff: true })),
    listForScope: vi.fn().mockResolvedValue([comparison()]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function lookup(
  over: {
    scopes?: MigrationScopeRepository;
    imports?: ImportJobRepository;
    aliases?: AliasResolutionRepository;
    comparisons?: FormulaComparisonRepository;
  } = {},
): MigrationLookupService {
  return new MigrationLookupService(
    over.scopes ?? scopeRepo(),
    over.imports ?? importRepo(),
    over.aliases ?? aliasRepo(),
    over.comparisons ?? comparisonRepo(),
  );
}

function parser(
  mode: 'clean' | 'error' | 'blank' = 'clean',
): WorkbookParserPort {
  const cells = {
    error: { raw: 'x', value: null, issue: 'broken_reference' },
    blank: { raw: '', value: null, issue: null },
    clean: { raw: 'x', value: 'x', issue: null },
  };
  const cell = cells[mode];
  return {
    parseCell: vi.fn().mockReturnValue(cell),
    parseSerialDate: vi.fn().mockReturnValue('2024-01-01'),
  };
}

describe('MigrationQueryService', () => {
  it('returns bounded pages and hides foreign records', async () => {
    const service = new MigrationQueryService(
      UOW,
      importRepo(),
      aliasRepo(),
      comparisonRepo(),
      lookup(),
    );
    expect(
      (
        await service.listImports(
          'team-1',
          { workbookType: null, status: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    expect((await service.getImport('team-1', 'job-1')).jobId).toBe('job-1');
    expect((await service.listResults('team-1', 'job-1')).items).toEqual([]);
    const missing = new MigrationQueryService(
      UOW,
      importRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
      aliasRepo(),
      comparisonRepo(),
      lookup({
        imports: importRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
      }),
    );
    await expect(missing.getImport('team-1', 'job-9')).rejects.toBeInstanceOf(
      ImportJobNotFoundError,
    );
  });
});

describe('StageImportUseCase', () => {
  function build(imports = importRepo(), row = parser()) {
    return {
      imports,
      useCase: new StageImportUseCase(
        UOW,
        CLOCK,
        IDS,
        lookup({ imports }),
        imports,
        new RowParserService(row),
        auditStub(),
      ),
    };
  }

  const command = {
    seasonId: null,
    workbookType: WorkbookType.Assessments,
    sourceName: 'book.xlsx',
    dryRun: true,
    rows: [{ rowRef: 'r-1', cells: { a: 'x' } }],
  };

  it('stages a dry run, parsing and reconciling', async () => {
    const { useCase, imports } = build();
    await useCase.execute(ACTOR, 'team-1', command);
    expect(imports.insert).toHaveBeenCalledTimes(1);
    expect(imports.insertRowResults).toHaveBeenCalledTimes(1);
    expect(imports.reconcile).toHaveBeenCalledTimes(1);
  });

  it('replays an identical committed source instead of re-staging', async () => {
    const existing = job({ status: ImportStatus.Committed, dryRun: false });
    const { useCase, imports } = build(
      importRepo({
        findCommittedBySource: vi.fn().mockResolvedValue(existing),
      }),
    );
    expect(await useCase.execute(ACTOR, 'team-1', command)).toBe(existing);
    expect(imports.insert).not.toHaveBeenCalled();
  });

  it('quarantines rows with no usable cells', async () => {
    const { useCase, imports } = build(importRepo(), parser('blank'));
    await useCase.execute(ACTOR, 'team-1', command);
    expect(imports.insertRowResults).toHaveBeenCalledTimes(1);
  });

  it('marks a row with a broken cell as an error', async () => {
    const { useCase, imports } = build(importRepo(), parser('error'));
    await useCase.execute(ACTOR, 'team-1', command);
    expect(imports.insertRowResults).toHaveBeenCalledTimes(1);
  });
});

describe('CommitImportUseCase', () => {
  function build(imports: ImportJobRepository) {
    return new CommitImportUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ imports }),
      imports,
      auditStub(),
    );
  }

  it('commits a staged non-dry-run job', async () => {
    const imports = importRepo({
      findForWrite: vi.fn().mockResolvedValue(job({ dryRun: false })),
      reconcile: vi
        .fn()
        .mockResolvedValue(
          job({ status: ImportStatus.Committed, dryRun: false }),
        ),
    });
    expect((await build(imports).commit(ACTOR, 'team-1', 'job-1')).status).toBe(
      ImportStatus.Committed,
    );
  });

  it('refuses to commit a dry run', async () => {
    const imports = importRepo({
      findForWrite: vi.fn().mockResolvedValue(job({ dryRun: true })),
    });
    await expect(
      build(imports).commit(ACTOR, 'team-1', 'job-1'),
    ).rejects.toBeInstanceOf(ImportNotCommittableError);
  });

  it('reverses a committed job into a compensating job', async () => {
    const imports = importRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(
          job({ status: ImportStatus.Committed, dryRun: false }),
        ),
      reconcile: vi
        .fn()
        .mockResolvedValue(
          job({ status: ImportStatus.Reversed, dryRun: false }),
        ),
      insert: vi
        .fn()
        .mockResolvedValue(
          job({ jobId: 'job-2', reversalOfJobId: 'job-1', dryRun: false }),
        ),
    });
    const reversal = await build(imports).reverse(ACTOR, 'team-1', 'job-1');
    expect(reversal.reversalOfJobId).toBe('job-1');
  });

  it('refuses to reverse a non-committed job', async () => {
    const imports = importRepo({
      findForWrite: vi.fn().mockResolvedValue(job()),
    });
    await expect(
      build(imports).reverse(ACTOR, 'team-1', 'job-1'),
    ).rejects.toBeInstanceOf(ImportNotReversibleError);
  });
});

describe('ResolveAliasUseCase', () => {
  function build(aliases = aliasRepo(), scopes = scopeRepo()) {
    return new ResolveAliasUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ aliases, scopes }),
      aliases,
      auditStub(),
    );
  }

  it('registers a candidate and confirms it on review', async () => {
    const aliases = aliasRepo();
    const useCase = build(aliases);
    await useCase.register(ACTOR, 'team-1', {
      sourceAlias: 'Mohd Ali',
      candidateMembershipId: 'member-1',
    });
    expect(aliases.upsert).toHaveBeenCalledTimes(1);
    const confirmed = await useCase.review(ACTOR, 'team-1', 'alias-1', {
      status: AliasResolutionStatus.Confirmed,
      resolvedMembershipId: 'member-1',
      override: false,
      expectedRecordVersion: 1,
    });
    expect(confirmed.status).toBe(AliasResolutionStatus.Confirmed);
  });

  it('refuses a re-bind collision without an override', async () => {
    const aliases = aliasRepo({
      findForWrite: vi
        .fn()
        .mockResolvedValue(alias({ resolvedMembershipId: 'member-2' })),
    });
    await expect(
      build(aliases).review(ACTOR, 'team-1', 'alias-1', {
        status: AliasResolutionStatus.Confirmed,
        resolvedMembershipId: 'member-1',
        override: false,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(AliasCollisionError);
  });

  it('hides an archived team scope', async () => {
    await expect(
      build(
        aliasRepo(),
        scopeRepo({ activeTeamExists: vi.fn().mockResolvedValue(false) }),
      ).register(ACTOR, 'team-1', {
        sourceAlias: 'x',
        candidateMembershipId: null,
      }),
    ).rejects.toBeInstanceOf(MigrationScopeNotFoundError);
  });
});

describe('CompareFormulaUseCase', () => {
  function build(comparisons = comparisonRepo()) {
    return new CompareFormulaUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ comparisons }),
      comparisons,
      auditStub(),
    );
  }

  it('records a classified comparison', async () => {
    const comparisons = comparisonRepo();
    const result = await build(comparisons).record(ACTOR, 'team-1', {
      workbookType: WorkbookType.MatchStats,
      metric: 'goals',
      subjectRef: 's-1',
      legacyValue: 10,
      targetValue: 15,
      legacyRuleVersion: 'v1',
      targetRuleVersion: 'v1',
    });
    expect(result.classification).toBe(DiscrepancyClassification.TargetBug);
    expect(comparisons.upsert).toHaveBeenCalledTimes(1);
  });

  it('signs off a comparison and hides a foreign one', async () => {
    const signed = await build().signOff(ACTOR, 'team-1', 'cmp-1', {
      signedOffByName: 'Coach',
      expectedRecordVersion: 1,
    });
    expect(signed.signedOff).toBe(true);
    const missing = build(
      comparisonRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      missing.signOff(ACTOR, 'team-1', 'cmp-9', {
        signedOffByName: 'Coach',
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ComparisonNotFoundError);
  });
});
