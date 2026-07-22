import type { AuditInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isResolveTarget,
  isSuppressTarget,
} from '../domain/anomaly.state-machine';
import { fingerprintOf } from '../domain/anomaly-alert.policy';
import {
  ANOMALY_RESOURCE_TYPE,
  DEFAULT_SUPPRESSION_HOURS,
  MILLISECONDS_PER_HOUR,
  REPAIR_RESOURCE_TYPE,
  RULE_VERSION,
} from '../model/dataquality.constants';
import type {
  AnomalyStatus,
  RepairKind,
  RepairStatus,
} from '../model/dataquality.enums';
import type {
  Anomaly,
  AnomalyStatusChange,
  AnomalyUpsert,
  DetectedAnomaly,
  NewRepair,
  Repair,
  RepairStatusChange,
  ScanReport,
  TransitionAnomalyCommand,
} from '../model/dataquality.types';
import { severityOf } from './dataquality.helpers';

// --- Anomalies ---------------------------------------------------------------

export function buildAnomalyUpsert(
  id: string,
  teamId: string,
  detected: DetectedAnomaly,
  now: Date,
): AnomalyUpsert {
  return {
    id,
    teamId,
    ruleKey: detected.ruleKey,
    ruleVersion: RULE_VERSION,
    severity: severityOf(detected.ruleKey),
    resourceType: detected.resourceType,
    resourceRef: detected.resourceRef,
    fingerprint: fingerprintOf(detected),
    now,
  };
}

export function buildAnomalyStatusChange(
  anomaly: Anomaly,
  target: AnomalyStatus,
  actorUserId: string,
  command: TransitionAnomalyCommand,
  now: Date,
): AnomalyStatusChange {
  const resolving = isResolveTarget(target);
  return {
    id: anomaly.anomalyId,
    teamId: anomaly.teamId,
    expectedRecordVersion: command.expectedRecordVersion,
    toStatus: target,
    ownerUserId: actorUserId,
    resolution: resolving ? command.resolution : anomaly.resolution,
    suppressedUntil: isSuppressTarget(target)
      ? new Date(
          now.getTime() + DEFAULT_SUPPRESSION_HOURS * MILLISECONDS_PER_HOUR,
        )
      : null,
    resolvedAt: resolving ? now : anomaly.resolvedAt,
    now,
  };
}

// --- Repairs -----------------------------------------------------------------

export function buildNewRepair(
  id: string,
  teamId: string,
  anomalyId: string,
  kind: RepairKind,
  impactCount: number,
  impactSummary: string,
  actorUserId: string,
  now: Date,
): NewRepair {
  return {
    id,
    teamId,
    anomalyId,
    repairKind: kind,
    impactCount,
    impactSummary,
    requestedBy: actorUserId,
    now,
  };
}

export function buildRepairStatusChange(
  repair: Repair,
  target: RepairStatus,
  rollbackRef: string | null,
  applied: boolean,
  rolledBack: boolean,
  now: Date,
): RepairStatusChange {
  return {
    id: repair.repairId,
    teamId: repair.teamId,
    expectedRecordVersion: repair.recordVersion,
    toStatus: target,
    rollbackRef: rollbackRef ?? repair.rollbackRef,
    appliedAt: applied ? now : repair.appliedAt,
    rolledBackAt: rolledBack ? now : repair.rolledBackAt,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildAnomalyAudit(
  action: string,
  actorUserId: string,
  anomaly: Anomaly,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ANOMALY_RESOURCE_TYPE,
    resourceId: anomaly.anomalyId,
    teamId: anomaly.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      ruleKey: anomaly.ruleKey,
      severity: anomaly.severity,
      status: anomaly.status,
      resourceType: anomaly.resourceType,
    },
  };
}

export function buildRepairAudit(
  action: string,
  actorUserId: string,
  repair: Repair,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: REPAIR_RESOURCE_TYPE,
    resourceId: repair.repairId,
    teamId: repair.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      anomalyId: repair.anomalyId,
      repairKind: repair.repairKind,
      status: repair.status,
      impactCount: repair.impactCount,
    },
  };
}

export function buildScanAudit(
  action: string,
  actorUserId: string,
  teamId: string,
  report: ScanReport,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ANOMALY_RESOURCE_TYPE,
    resourceId: null,
    teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      ruleVersion: report.ruleVersion,
      rulesRun: report.rulesRun,
      detected: report.detected,
      opened: report.opened,
      alertable: report.alertable,
    },
  };
}
