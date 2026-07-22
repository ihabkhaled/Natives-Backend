import {
  ANOMALY_RESOURCE_TYPE_VALUES,
  ANOMALY_SEVERITY_VALUES,
  ANOMALY_STATUS_VALUES,
  DATA_QUALITY_RULE_VALUES,
  REPAIR_KIND_VALUES,
  REPAIR_STATUS_VALUES,
} from '../model/dataquality.enums';
import type { AnomalyRow, RepairRow } from '../model/dataquality.rows';
import type { Anomaly, Repair } from '../model/dataquality.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNumber,
} from './dataquality.helpers';

export function toAnomaly(row: AnomalyRow): Anomaly {
  return {
    anomalyId: row.id,
    teamId: row.team_id,
    ruleKey: parseEnumValue(DATA_QUALITY_RULE_VALUES, row.rule_key, 'rule'),
    ruleVersion: row.rule_version,
    severity: parseEnumValue(ANOMALY_SEVERITY_VALUES, row.severity, 'severity'),
    resourceType: parseEnumValue(
      ANOMALY_RESOURCE_TYPE_VALUES,
      row.resource_type,
      'resource type',
    ),
    resourceRef: row.resource_ref,
    fingerprint: row.fingerprint,
    occurrenceCount: toNumber(row.occurrence_count),
    status: parseEnumValue(ANOMALY_STATUS_VALUES, row.status, 'anomaly status'),
    ownerUserId: row.owner_user_id,
    resolution: row.resolution,
    suppressedUntil: toNullableDate(row.suppressed_until),
    recordVersion: toNumber(row.record_version),
    firstSeenAt: toDate(row.first_seen_at),
    lastSeenAt: toDate(row.last_seen_at),
    resolvedAt: toNullableDate(row.resolved_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toRepair(row: RepairRow): Repair {
  return {
    repairId: row.id,
    teamId: row.team_id,
    anomalyId: row.anomaly_id,
    repairKind: parseEnumValue(
      REPAIR_KIND_VALUES,
      row.repair_kind,
      'repair kind',
    ),
    status: parseEnumValue(REPAIR_STATUS_VALUES, row.status, 'repair status'),
    impactCount: toNumber(row.impact_count),
    impactSummary: row.impact_summary,
    rollbackRef: row.rollback_ref,
    recordVersion: toNumber(row.record_version),
    requestedBy: row.requested_by,
    appliedAt: toNullableDate(row.applied_at),
    rolledBackAt: toNullableDate(row.rolled_back_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}
