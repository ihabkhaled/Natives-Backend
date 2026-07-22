import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  AnomalyStatus,
  DataQualityRule,
  RepairKind,
  RepairStatus,
} from '../model/dataquality.enums';
import type { AnomalyRow, RepairRow } from '../model/dataquality.rows';
import { AnomalyRepository } from './anomaly.repository';
import { DetectionRepository } from './detection.repository';
import { RepairRepository } from './repair.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const ANOMALY_ROW: AnomalyRow = {
  id: 'a-1',
  team_id: 'team-1',
  rule_key: 'jersey_conflict',
  rule_version: 'dq-v1',
  severity: 'warning',
  resource_type: 'reservation',
  resource_ref: 'ref-1',
  fingerprint: 'fp',
  occurrence_count: 1,
  status: 'open',
  owner_user_id: null,
  resolution: null,
  suppressed_until: null,
  record_version: 1,
  first_seen_at: NOW,
  last_seen_at: NOW,
  resolved_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const REPAIR_ROW: RepairRow = {
  id: 'rep-1',
  team_id: 'team-1',
  anomaly_id: 'a-1',
  repair_kind: 'release_jersey',
  status: 'previewed',
  impact_count: 2,
  impact_summary: 'summary',
  rollback_ref: null,
  record_version: 1,
  requested_by: 'user-1',
  applied_at: null,
  rolled_back_at: null,
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

describe('AnomalyRepository', () => {
  const repository = new AnomalyRepository();
  const upsert = {
    id: 'a-1',
    teamId: 'team-1',
    ruleKey: DataQualityRule.JerseyConflict,
    ruleVersion: 'dq-v1',
    severity: 'warning' as never,
    resourceType: 'reservation' as never,
    resourceRef: 'ref-1',
    fingerprint: 'fp',
    now: NOW,
  };

  it('upserts by fingerprint, reopening a resolved anomaly', async () => {
    const { scope, run } = scopeReturning([ANOMALY_ROW]);
    expect((await repository.upsert(scope, upsert)).status).toBe(
      AnomalyStatus.Open,
    );
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
    expect(String(run.mock.calls[0]?.[0])).toContain(`THEN 'open'`);
  });

  it('throws when an anomaly write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.upsert(scope, upsert)).rejects.toThrow(
      /anomaly write/u,
    );
  });

  it('resolves, guards a status change, lists, and probes team', async () => {
    const found = scopeReturning([ANOMALY_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'a-1'))?.anomalyId,
    ).toBe('a-1');
    const applied = scopeReturning([{ ...ANOMALY_ROW, status: 'resolved' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'a-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: AnomalyStatus.Resolved,
          ownerUserId: 'user-1',
          resolution: 'fixed',
          suppressedUntil: null,
          resolvedAt: NOW,
          now: NOW,
        })
      )?.status,
    ).toBe(AnomalyStatus.Resolved);
    const stale = scopeReturning([]);
    expect(
      await repository.applyStatusChange(stale.scope, {
        id: 'a-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        toStatus: AnomalyStatus.Resolved,
        ownerUserId: null,
        resolution: null,
        suppressedUntil: null,
        resolvedAt: null,
        now: NOW,
      }),
    ).toBeNull();
    const filter = { ruleKey: null, severity: null, status: null };
    const list = scopeReturning([ANOMALY_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 3 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      3,
    );
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
  });
});

describe('RepairRepository', () => {
  const repository = new RepairRepository();

  it('inserts, resolves, finds the latest, and guards a status change', async () => {
    const inserted = scopeReturning([REPAIR_ROW]);
    expect(
      (
        await repository.insert(inserted.scope, {
          id: 'rep-1',
          teamId: 'team-1',
          anomalyId: 'a-1',
          repairKind: RepairKind.ReleaseJersey,
          impactCount: 2,
          impactSummary: 'summary',
          requestedBy: 'user-1',
          now: NOW,
        })
      ).status,
    ).toBe(RepairStatus.Previewed);
    const found = scopeReturning([REPAIR_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'rep-1'))?.repairId,
    ).toBe('rep-1');
    const latest = scopeReturning([{ ...REPAIR_ROW, status: 'applied' }]);
    expect(
      (await repository.findLatestForAnomaly(latest.scope, 'team-1', 'a-1'))
        ?.status,
    ).toBe(RepairStatus.Applied);
    const none = scopeReturning([]);
    expect(
      await repository.findLatestForAnomaly(none.scope, 'team-1', 'a-9'),
    ).toBeNull();
    const applied = scopeReturning([{ ...REPAIR_ROW, status: 'applied' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'rep-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: RepairStatus.Applied,
          rollbackRef: 'rollback:rep-1',
          appliedAt: NOW,
          rolledBackAt: null,
          now: NOW,
        })
      )?.status,
    ).toBe(RepairStatus.Applied);
  });

  it('throws when a repair write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      repository.insert(scope, {
        id: 'rep-1',
        teamId: 'team-1',
        anomalyId: 'a-1',
        repairKind: RepairKind.ReleaseJersey,
        impactCount: 2,
        impactSummary: 'summary',
        requestedBy: 'user-1',
        now: NOW,
      }),
    ).rejects.toThrow(/repair write/u);
  });
});

describe('DetectionRepository', () => {
  const repository = new DetectionRepository();

  it('probes team and runs read-only detections returning ids only', async () => {
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const jersey = scopeReturning([
      {
        resource_ref: 'season:open:7',
        resource_type: 'reservation',
        detail: '2',
      },
    ]);
    const jerseyAnomalies = await repository.detectJerseyConflicts(
      jersey.scope,
      'team-1',
    );
    expect(jerseyAnomalies[0]?.ruleKey).toBe(DataQualityRule.JerseyConflict);
    expect(String(jersey.run.mock.calls[0]?.[0])).toContain('HAVING COUNT(*)');
    const orphan = scopeReturning([
      { resource_ref: 'l-1', resource_type: 'ledger_entry', detail: '' },
    ]);
    expect(
      (await repository.detectOrphanPoints(orphan.scope, 'team-1'))[0]?.ruleKey,
    ).toBe(DataQualityRule.OrphanPoints);
    const stale = scopeReturning([
      { resource_ref: 'p-1', resource_type: 'projection', detail: '' },
    ]);
    expect(
      (await repository.detectStaleProjections(stale.scope, 'team-1', NOW))[0]
        ?.ruleKey,
    ).toBe(DataQualityRule.StaleProjection);
  });
});
