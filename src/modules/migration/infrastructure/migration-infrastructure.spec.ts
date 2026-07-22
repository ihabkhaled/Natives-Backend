import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  AliasResolutionStatus,
  AliasSource,
  DiscrepancyClassification,
  ImportStatus,
  RowAction,
  RowOutcome,
  WorkbookType,
} from '../model/migration.enums';
import type {
  AliasResolutionRow,
  ComparisonRow,
  ImportJobRow,
  RowResultRow,
} from '../model/migration.rows';
import { AliasResolutionRepository } from './alias-resolution.repository';
import { FormulaComparisonRepository } from './formula-comparison.repository';
import { ImportJobRepository } from './import-job.repository';
import { MigrationScopeRepository } from './migration-scope.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const JOB_ROW: ImportJobRow = {
  id: 'job-1',
  team_id: 'team-1',
  season_id: null,
  workbook_type: 'assessments',
  mapper_version: 'mapper-v1',
  source_hash: 'hash',
  source_name: 'book.xlsx',
  dry_run: true,
  status: 'staged',
  received_rows: 3,
  staged_rows: 2,
  committed_rows: 0,
  skipped_rows: 0,
  error_rows: 1,
  quarantined_rows: 0,
  reversal_of_job_id: null,
  record_version: 1,
  requested_by: 'user-1',
  committed_at: null,
  reversed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const RESULT_ROW: RowResultRow = {
  id: 'res-1',
  team_id: 'team-1',
  job_id: 'job-1',
  row_ref: 'r-1',
  outcome: 'staged',
  action: 'none',
  entity_ref: null,
  message_key: null,
  created_at: NOW,
};

const ALIAS_ROW: AliasResolutionRow = {
  id: 'alias-1',
  team_id: 'team-1',
  source: 'import',
  source_alias: 'Mohd Ali',
  normalized_alias: 'mohamed ali',
  candidate_membership_id: 'member-1',
  confidence: '0.95',
  status: 'pending',
  resolved_membership_id: null,
  override: false,
  record_version: 1,
  reviewed_by: null,
  reviewed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const COMPARISON_ROW: ComparisonRow = {
  id: 'cmp-1',
  team_id: 'team-1',
  workbook_type: 'match_stats',
  metric: 'goals',
  subject_ref: 's-1',
  legacy_value: '10',
  target_value: '15',
  difference: '5',
  classification: 'target_bug',
  legacy_rule_version: 'v1',
  target_rule_version: 'v1',
  artifact_checksum: 'checksum',
  signed_off: false,
  signed_off_by_name: null,
  record_version: 1,
  signed_off_at: null,
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

describe('MigrationScopeRepository', () => {
  const repository = new MigrationScopeRepository();

  it('probes team and membership', async () => {
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const member = scopeReturning([]);
    expect(
      await repository.membershipExists(member.scope, 'team-1', 'member-9'),
    ).toBe(false);
  });
});

describe('ImportJobRepository', () => {
  const repository = new ImportJobRepository();
  const newJob = {
    id: 'job-1',
    teamId: 'team-1',
    seasonId: null,
    workbookType: WorkbookType.Assessments,
    mapperVersion: 'mapper-v1',
    sourceHash: 'hash',
    sourceName: 'book.xlsx',
    dryRun: true,
    reversalOfJobId: null,
    requestedBy: 'user-1',
    now: NOW,
  };

  it('inserts a job and finds a committed source', async () => {
    const inserted = scopeReturning([JOB_ROW]);
    expect((await repository.insert(inserted.scope, newJob)).status).toBe(
      ImportStatus.Staged,
    );
    const committed = scopeReturning([{ ...JOB_ROW, dry_run: false }]);
    expect(
      (
        await repository.findCommittedBySource(
          committed.scope,
          'team-1',
          'hash',
          'mapper-v1',
        )
      )?.jobId,
    ).toBe('job-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findCommittedBySource(
        missing.scope,
        'team-1',
        'none',
        'mapper-v1',
      ),
    ).toBeNull();
  });

  it('throws when a job write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newJob)).rejects.toThrow(
      /import job write/u,
    );
  });

  it('reconciles under a version guard and writes row results', async () => {
    const reconciliation = {
      id: 'job-1',
      teamId: 'team-1',
      expectedRecordVersion: 1,
      status: ImportStatus.Committed,
      receivedRows: 3,
      stagedRows: 0,
      committedRows: 2,
      skippedRows: 0,
      errorRows: 1,
      quarantinedRows: 0,
      committed: true,
      reversed: false,
      now: NOW,
    };
    const applied = scopeReturning([{ ...JOB_ROW, status: 'committed' }]);
    expect(
      (await repository.reconcile(applied.scope, reconciliation))?.status,
    ).toBe(ImportStatus.Committed);
    const stale = scopeReturning([]);
    expect(
      await repository.reconcile(stale.scope, {
        ...reconciliation,
        expectedRecordVersion: 9,
      }),
    ).toBeNull();
    const results = scopeReturning([]);
    await repository.insertRowResults(results.scope, [
      {
        id: 'res-1',
        teamId: 'team-1',
        jobId: 'job-1',
        rowRef: 'r-1',
        outcome: RowOutcome.Staged,
        action: RowAction.None,
        entityRef: null,
        messageKey: null,
        now: NOW,
      },
    ]);
    expect(results.run).toHaveBeenCalledTimes(1);
  });

  it('lists results, jobs, and counts', async () => {
    const list = scopeReturning([RESULT_ROW]);
    expect(await repository.listResults(list.scope, 'job-1')).toHaveLength(1);
    const jobs = scopeReturning([JOB_ROW]);
    expect(
      await repository.listForScope(
        jobs.scope,
        'team-1',
        { workbookType: null, status: null },
        { limit: 900, offset: 0 },
      ),
    ).toHaveLength(1);
    expect(jobs.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 2 }]);
    expect(
      await repository.countForScope(count.scope, 'team-1', {
        workbookType: null,
        status: null,
      }),
    ).toBe(2);
  });
});

describe('AliasResolutionRepository', () => {
  const repository = new AliasResolutionRepository();

  it('upserts, resolves, reviews, lists, and counts', async () => {
    const upserted = scopeReturning([ALIAS_ROW]);
    expect(
      (
        await repository.upsert(upserted.scope, {
          id: 'alias-1',
          teamId: 'team-1',
          source: AliasSource.Import,
          sourceAlias: 'Mohd Ali',
          normalizedAlias: 'mohamed ali',
          candidateMembershipId: 'member-1',
          confidence: 0.95,
          status: AliasResolutionStatus.Pending,
          now: NOW,
        })
      ).normalizedAlias,
    ).toBe('mohamed ali');
    const found = scopeReturning([ALIAS_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'alias-1'))
        ?.resolutionId,
    ).toBe('alias-1');
    const reviewed = scopeReturning([{ ...ALIAS_ROW, status: 'confirmed' }]);
    expect(
      (
        await repository.applyReview(reviewed.scope, {
          id: 'alias-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          status: AliasResolutionStatus.Confirmed,
          resolvedMembershipId: 'member-1',
          override: false,
          reviewedBy: 'user-1',
          now: NOW,
        })
      )?.status,
    ).toBe(AliasResolutionStatus.Confirmed);
    const list = scopeReturning([ALIAS_ROW]);
    expect(
      await repository.listForScope(
        list.scope,
        'team-1',
        { status: null },
        { limit: 20, offset: 0 },
      ),
    ).toHaveLength(1);
    const count = scopeReturning([{ count: 4 }]);
    expect(
      await repository.countForScope(count.scope, 'team-1', { status: null }),
    ).toBe(4);
  });

  it('throws when an alias write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      repository.upsert(scope, {
        id: 'alias-1',
        teamId: 'team-1',
        source: AliasSource.Import,
        sourceAlias: 'x',
        normalizedAlias: 'x',
        candidateMembershipId: null,
        confidence: 0,
        status: AliasResolutionStatus.Pending,
        now: NOW,
      }),
    ).rejects.toThrow(/alias write/u);
  });
});

describe('FormulaComparisonRepository', () => {
  const repository = new FormulaComparisonRepository();

  it('upserts clearing sign-off, resolves, signs off, lists, and counts', async () => {
    const upserted = scopeReturning([COMPARISON_ROW]);
    expect(
      (
        await repository.upsert(upserted.scope, {
          id: 'cmp-1',
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
          now: NOW,
        })
      ).classification,
    ).toBe(DiscrepancyClassification.TargetBug);
    expect(String(upserted.run.mock.calls[0]?.[0])).toContain(
      '"signed_off" = false',
    );
    const signed = scopeReturning([
      { ...COMPARISON_ROW, signed_off: true, signed_off_by_name: 'Coach' },
    ]);
    expect(
      (
        await repository.signOff(signed.scope, {
          id: 'cmp-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          signedOffByName: 'Coach',
          now: NOW,
        })
      )?.signedOff,
    ).toBe(true);
    const stale = scopeReturning([]);
    expect(
      await repository.signOff(stale.scope, {
        id: 'cmp-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        signedOffByName: 'Coach',
        now: NOW,
      }),
    ).toBeNull();
    const list = scopeReturning([COMPARISON_ROW]);
    expect(
      await repository.listForScope(
        list.scope,
        'team-1',
        { workbookType: null, classification: null, signedOff: null },
        { limit: 20, offset: 0 },
      ),
    ).toHaveLength(1);
    const count = scopeReturning([{ count: 6 }]);
    expect(
      await repository.countForScope(count.scope, 'team-1', {
        workbookType: null,
        classification: null,
        signedOff: false,
      }),
    ).toBe(6);
  });

  it('throws when a comparison write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      repository.upsert(scope, {
        id: 'cmp-1',
        teamId: 'team-1',
        workbookType: WorkbookType.MatchStats,
        metric: 'goals',
        subjectRef: 's-1',
        legacyValue: 10,
        targetValue: 15,
        difference: 5,
        classification: DiscrepancyClassification.TargetBug,
        legacyRuleVersion: null,
        targetRuleVersion: null,
        artifactChecksum: 'checksum',
        now: NOW,
      }),
    ).rejects.toThrow(/comparison write/u);
  });
});
