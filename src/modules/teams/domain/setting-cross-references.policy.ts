import type { ValidationIssue } from '@core/validation';

import { AttendanceStatus } from '../../practices/model/attendance.enums';
import {
  CONSTRAINT_SUBJECT_SEPARATOR,
  PRESENT_FAMILY_STATUS_CODES,
  SETTING_VALUE_CONSTRAINTS,
} from '../model/setting-values.constants';
import type {
  AttendanceStatusesValue,
  AttendanceWeightsValue,
  RosterLimitsValue,
} from '../model/setting-values.types';

/**
 * Pure cross-setting validation (P2, decision D3). Weights are strict at
 * weights-write time: every key must be an active status of the
 * `attendance_statuses` value effective at the weights' `effectiveFrom`, and
 * every active counts-toward status must be covered. A later statuses write is
 * never blocked by existing weights — instead the snapshot surfaces the gap
 * through `collectSnapshotIssues` so it is honest, never silent.
 */

const CONSTRAINTS = SETTING_VALUE_CONSTRAINTS;
const WEIGHTS_FIELD = 'value.weights';
const POSITIONS_FIELD = 'value.perPosition';

function tagged(code: string, subject: string): string {
  return `${code}${CONSTRAINT_SUBJECT_SEPARATOR}${subject}`;
}

function issueAt(field: string, constraint: string): ValidationIssue {
  return { field, constraint };
}

function activeStatusCodes(statuses: AttendanceStatusesValue): Set<string> {
  const codes = new Set<string>();
  for (const entry of statuses.statuses) {
    if (entry.active) {
      codes.add(entry.code);
    }
  }
  return codes;
}

function requiredCoverageCodes(statuses: AttendanceStatusesValue): string[] {
  return statuses.statuses
    .filter(entry => entry.active && entry.countsTowardMetrics)
    .map(entry => entry.code);
}

/**
 * Issue codes (`weights_unknown_status:<code>` / `weights_missing_status:<code>`
 * / `statuses_not_configured`) shared by write-time rejection and snapshot
 * surfacing so the frontend maps one vocabulary.
 */
export function collectWeightsIssueCodes(
  weights: AttendanceWeightsValue,
  statuses: AttendanceStatusesValue | null,
): readonly string[] {
  if (statuses === null) {
    return [CONSTRAINTS.statusesNotConfigured];
  }
  const active = activeStatusCodes(statuses);
  const weightByCode = toWeightMap(weights);
  const codes: string[] = [];
  for (const code of weightByCode.keys()) {
    if (!active.has(code)) {
      codes.push(tagged(CONSTRAINTS.weightsUnknownStatus, code));
    }
  }
  for (const code of requiredCoverageCodes(statuses)) {
    if (!weightByCode.has(code)) {
      codes.push(tagged(CONSTRAINTS.weightsMissingStatus, code));
    }
  }
  return codes;
}

/** Injection-safe lookup view over the weights record. */
function toWeightMap(
  weights: AttendanceWeightsValue,
): ReadonlyMap<string, number> {
  return new Map(Object.entries(weights.weights));
}

/** Absent, if weighted, must not exceed any present-family weight. */
function absentInversionIssues(
  weights: AttendanceWeightsValue,
): readonly ValidationIssue[] {
  const weightByCode = toWeightMap(weights);
  const absent = weightByCode.get(AttendanceStatus.Absent);
  if (absent === undefined) {
    return [];
  }
  const inverted = PRESENT_FAMILY_STATUS_CODES.some(code => {
    const presentWeight = weightByCode.get(code);
    return presentWeight !== undefined && presentWeight < absent;
  });
  if (!inverted) {
    return [];
  }
  return [issueAt(WEIGHTS_FIELD, CONSTRAINTS.absentWeightExceedsPresent)];
}

/**
 * Write-time cross-reference check for an `attendance_weights` version against
 * the `attendance_statuses` value effective at the weights' own instant (D3).
 */
export function collectWeightsCrossReferenceIssues(
  weights: AttendanceWeightsValue,
  statuses: AttendanceStatusesValue | null,
): readonly ValidationIssue[] {
  const codeIssues = collectWeightsIssueCodes(weights, statuses).map(code =>
    issueAt(WEIGHTS_FIELD, code),
  );
  return [...codeIssues, ...absentInversionIssues(weights)];
}

/**
 * Write-time cross-reference check for `roster_limits.perPosition` keys against
 * the team's ACTIVE `position` reference-catalog entries.
 */
export function collectRosterCrossReferenceIssues(
  value: RosterLimitsValue,
  activePositionKeys: readonly string[],
): readonly ValidationIssue[] {
  if (value.perPosition === undefined) {
    return [];
  }
  const known = new Set(activePositionKeys);
  return value.perPosition
    .filter(limit => !known.has(limit.positionKey))
    .map(limit =>
      issueAt(
        POSITIONS_FIELD,
        tagged(CONSTRAINTS.unknownPosition, limit.positionKey),
      ),
    );
}

/**
 * Snapshot-time surfacing (D3): when the effective weights do not line up with
 * the effective statuses, the snapshot's weights entry carries these issue
 * codes instead of silently substituting zeros.
 */
export function collectSnapshotIssues(
  statuses: AttendanceStatusesValue | null,
  weights: AttendanceWeightsValue | null,
): readonly string[] {
  if (weights === null) {
    return [];
  }
  return collectWeightsIssueCodes(weights, statuses);
}
