import { RULE_REPAIR } from '../model/dataquality.constants';
import type { DataQualityRule } from '../model/dataquality.enums';
import {
  AnomalyStatus,
  RepairKind,
  RepairStatus,
} from '../model/dataquality.enums';
import type { Anomaly, RepairPreview } from '../model/dataquality.types';

/**
 * Pure repair rules (UN-705).
 *
 * A repair runs ONLY through a domain service and ONLY after a preview: a check
 * is read-only unless an explicit repair is requested, so nothing is ever
 * mutated by a raw SQL sweep. A repair is offered only for a rule that supports
 * one and only for an anomaly that is still actionable (open or acknowledged),
 * and every offered repair records whether it is reversible so an operator knows
 * the rollback story before applying it.
 */
export function repairKindFor(rule: DataQualityRule): RepairKind | null {
  return RULE_REPAIR.get(rule) ?? null;
}

export function isRepairable(anomaly: Anomaly): boolean {
  if (repairKindFor(anomaly.ruleKey) === null) {
    return false;
  }
  return (
    anomaly.status === AnomalyStatus.Open ||
    anomaly.status === AnomalyStatus.Acknowledged
  );
}

/** Whether a repair kind can be rolled back after it is applied. */
export function isReversible(kind: RepairKind): boolean {
  return kind !== RepairKind.MergeDuplicate;
}

/** Build the read-only preview of a repair's impact. */
export function buildPreview(
  anomaly: Anomaly,
  kind: RepairKind,
): RepairPreview {
  return {
    anomalyId: anomaly.anomalyId,
    repairKind: kind,
    impactCount: anomaly.occurrenceCount,
    impactSummary: `${kind} affects ${anomaly.occurrenceCount} record(s) for ${anomaly.resourceType}`,
    reversible: isReversible(kind),
  };
}

/** Whether a previewed repair may be applied. */
export function canApply(status: RepairStatus): boolean {
  return status === RepairStatus.Previewed;
}

/** Whether an applied repair may be rolled back. */
export function canRollback(status: RepairStatus, kind: RepairKind): boolean {
  return status === RepairStatus.Applied && isReversible(kind);
}
