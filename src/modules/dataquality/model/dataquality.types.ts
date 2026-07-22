import type {
  AnomalyResourceType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyTransition,
  DataQualityRule,
  RepairKind,
  RepairStatus,
} from './dataquality.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Anomalies ---------------------------------------------------------------

export interface Anomaly {
  readonly anomalyId: string;
  readonly teamId: string;
  readonly ruleKey: DataQualityRule;
  readonly ruleVersion: string;
  readonly severity: AnomalySeverity;
  readonly resourceType: AnomalyResourceType;
  readonly resourceRef: string;
  readonly fingerprint: string;
  readonly occurrenceCount: number;
  readonly status: AnomalyStatus;
  readonly ownerUserId: string | null;
  readonly resolution: string | null;
  readonly suppressedUntil: Date | null;
  readonly recordVersion: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A detected anomaly ready for its idempotent upsert (open or bump). */
export interface AnomalyUpsert {
  readonly id: string;
  readonly teamId: string;
  readonly ruleKey: DataQualityRule;
  readonly ruleVersion: string;
  readonly severity: AnomalySeverity;
  readonly resourceType: AnomalyResourceType;
  readonly resourceRef: string;
  readonly fingerprint: string;
  readonly now: Date;
}

/** A pure detected anomaly from a rule check. Ids only. */
export interface DetectedAnomaly {
  readonly ruleKey: DataQualityRule;
  readonly resourceType: AnomalyResourceType;
  readonly resourceRef: string;
}

/** A version-guarded lifecycle change of an anomaly. */
export interface AnomalyStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: AnomalyStatus;
  readonly ownerUserId: string | null;
  readonly resolution: string | null;
  readonly suppressedUntil: Date | null;
  readonly resolvedAt: Date | null;
  readonly now: Date;
}

export interface TransitionAnomalyCommand {
  readonly transition: AnomalyTransition;
  readonly resolution: string | null;
  readonly expectedRecordVersion: number;
}

export type AnomalyPage = PagedResult<Anomaly>;

export interface AnomalyListFilter {
  readonly ruleKey: DataQualityRule | null;
  readonly severity: AnomalySeverity | null;
  readonly status: AnomalyStatus | null;
}

export interface AnomalyListFilterInput {
  readonly ruleKey?: DataQualityRule | null;
  readonly severity?: AnomalySeverity | null;
  readonly status?: AnomalyStatus | null;
}

// --- Scan --------------------------------------------------------------------

export interface ScanCommand {
  readonly rules: readonly DataQualityRule[] | null;
}

export interface ScanCommandInput {
  readonly rules?: readonly DataQualityRule[] | null;
}

/** The reconciliation of one scan run. */
export interface ScanReport {
  readonly ruleVersion: string;
  readonly rulesRun: number;
  readonly detected: number;
  readonly opened: number;
  readonly reopened: number;
  readonly alertable: number;
}

// --- Repairs -----------------------------------------------------------------

export interface Repair {
  readonly repairId: string;
  readonly teamId: string;
  readonly anomalyId: string;
  readonly repairKind: RepairKind;
  readonly status: RepairStatus;
  readonly impactCount: number;
  readonly impactSummary: string | null;
  readonly rollbackRef: string | null;
  readonly recordVersion: number;
  readonly requestedBy: string | null;
  readonly appliedAt: Date | null;
  readonly rolledBackAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewRepair {
  readonly id: string;
  readonly teamId: string;
  readonly anomalyId: string;
  readonly repairKind: RepairKind;
  readonly impactCount: number;
  readonly impactSummary: string | null;
  readonly requestedBy: string;
  readonly now: Date;
}

/** A version-guarded status change of a repair. */
export interface RepairStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: RepairStatus;
  readonly rollbackRef: string | null;
  readonly appliedAt: Date | null;
  readonly rolledBackAt: Date | null;
  readonly now: Date;
}

/** The preview of a repair's impact before it is applied. */
export interface RepairPreview {
  readonly anomalyId: string;
  readonly repairKind: RepairKind;
  readonly impactCount: number;
  readonly impactSummary: string;
  readonly reversible: boolean;
}

/** The resolved team scope of a data-quality operation. */
export interface DataQualityScope {
  readonly teamId: string;
}
