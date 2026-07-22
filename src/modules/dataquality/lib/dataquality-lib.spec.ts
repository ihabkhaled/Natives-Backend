import { describe, expect, it } from 'vitest';

import {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyTransition,
  DataQualityRule,
  RepairKind,
  RepairStatus,
} from '../model/dataquality.enums';
import type { AnomalyRow, RepairRow } from '../model/dataquality.rows';
import type { Anomaly, Repair } from '../model/dataquality.types';
import {
  buildAnomalyAudit,
  buildAnomalyStatusChange,
  buildAnomalyUpsert,
  buildNewRepair,
  buildRepairAudit,
  buildRepairStatusChange,
  buildScanAudit,
} from './dataquality.builders';
import {
  parseEnumValue,
  resolveDataQualityPage,
  severityOf,
  toDate,
  toNullableDate,
  toNumber,
} from './dataquality.helpers';
import { toAnomaly, toRepair } from './dataquality.mapper';
import {
  toAnomalyListFilter,
  toScanCommand,
} from './dataquality-command.mapper';

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
  occurrence_count: '2',
  status: 'open',
  owner_user_id: null,
  resolution: null,
  suppressed_until: null,
  record_version: '1',
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
  impact_count: '2',
  impact_summary: 'summary',
  rollback_ref: null,
  record_version: '1',
  requested_by: 'user-1',
  applied_at: null,
  rolled_back_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const ANOMALY: Anomaly = toAnomaly(ANOMALY_ROW);
const REPAIR: Repair = toRepair(REPAIR_ROW);

describe('data-quality helpers', () => {
  it('clamps paging, coerces values, and resolves rule severity', () => {
    expect(resolveDataQualityPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(toDate(NOW)).toBe(NOW);
    expect(toNullableDate(null)).toBeNull();
    expect(toNumber('4')).toBe(4);
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'x')).toThrow(/x/u);
    expect(severityOf(DataQualityRule.DuplicateIdentity)).toBe(
      AnomalySeverity.Critical,
    );
    expect(severityOf(DataQualityRule.MissingAlias)).toBe(AnomalySeverity.Info);
  });
});

describe('data-quality mapper', () => {
  it('maps an anomaly and a repair', () => {
    expect(ANOMALY.ruleKey).toBe(DataQualityRule.JerseyConflict);
    expect(ANOMALY.status).toBe(AnomalyStatus.Open);
    expect(ANOMALY.occurrenceCount).toBe(2);
    expect(REPAIR.repairKind).toBe(RepairKind.ReleaseJersey);
    expect(REPAIR.status).toBe(RepairStatus.Previewed);
  });
});

describe('data-quality command mapper', () => {
  it('normalizes a scan command and filter', () => {
    expect(toScanCommand({}).rules).toBeNull();
    expect(
      toScanCommand({ rules: [DataQualityRule.JerseyConflict] }).rules,
    ).toEqual([DataQualityRule.JerseyConflict]);
    expect(toAnomalyListFilter({})).toEqual({
      ruleKey: null,
      severity: null,
      status: null,
    });
  });
});

describe('data-quality builders', () => {
  it('builds an upsert with the rule severity and fingerprint', () => {
    const upsert = buildAnomalyUpsert(
      'id-1',
      'team-1',
      {
        ruleKey: DataQualityRule.DuplicateIdentity,
        resourceType: 'membership' as never,
        resourceRef: 'm-1',
      },
      NOW,
    );
    expect(upsert.severity).toBe(AnomalySeverity.Critical);
    expect(upsert.fingerprint).toContain('duplicate_identity');
  });

  it('stamps a resolution and a suppression window', () => {
    const resolved = buildAnomalyStatusChange(
      ANOMALY,
      AnomalyStatus.Resolved,
      'user-1',
      {
        transition: AnomalyTransition.Resolve,
        resolution: 'fixed',
        expectedRecordVersion: 1,
      },
      NOW,
    );
    expect(resolved.resolvedAt).toBe(NOW);
    expect(resolved.resolution).toBe('fixed');
    const suppressed = buildAnomalyStatusChange(
      ANOMALY,
      AnomalyStatus.Suppressed,
      'user-1',
      {
        transition: AnomalyTransition.Suppress,
        resolution: null,
        expectedRecordVersion: 1,
      },
      NOW,
    );
    expect(suppressed.suppressedUntil?.getTime()).toBeGreaterThan(
      NOW.getTime(),
    );
  });

  it('builds repair rows and stamps only the instants a change owns', () => {
    const newRepair = buildNewRepair(
      'id-1',
      'team-1',
      'a-1',
      RepairKind.ReleaseJersey,
      2,
      'summary',
      'user-1',
      NOW,
    );
    expect(newRepair.impactCount).toBe(2);
    const applied = buildRepairStatusChange(
      REPAIR,
      RepairStatus.Applied,
      'rollback:rep-1',
      true,
      false,
      NOW,
    );
    expect(applied.appliedAt).toBe(NOW);
    expect(applied.rolledBackAt).toBeNull();
  });

  it('audits with classifications only', () => {
    expect(
      buildAnomalyAudit('data_quality.anomaly.transitioned', 'user-1', ANOMALY)
        .diff['ruleKey'],
    ).toBe('jersey_conflict');
    expect(
      buildRepairAudit('data_quality.repair.applied', 'user-1', REPAIR).diff[
        'repairKind'
      ],
    ).toBe('release_jersey');
    expect(
      buildScanAudit('data_quality.scan.completed', 'user-1', 'team-1', {
        ruleVersion: 'dq-v1',
        rulesRun: 3,
        detected: 5,
        opened: 2,
        reopened: 1,
        alertable: 3,
      }).diff['detected'],
    ).toBe(5);
  });
});
