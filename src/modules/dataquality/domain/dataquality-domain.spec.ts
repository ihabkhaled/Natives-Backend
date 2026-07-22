import { describe, expect, it } from 'vitest';

import {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyTransition,
  DataQualityRule,
  RepairKind,
  RepairStatus,
} from '../model/dataquality.enums';
import type { Anomaly, DetectedAnomaly } from '../model/dataquality.types';
import {
  anomalyTargetOf,
  canTransitionAnomaly,
  isReopenTarget,
  isResolveTarget,
  isSuppressTarget,
  shouldReopen,
} from './anomaly.state-machine';
import {
  countAlertable,
  fingerprintOf,
  isAlertable,
} from './anomaly-alert.policy';
import {
  buildPreview,
  canApply,
  canRollback,
  isRepairable,
  isReversible,
  repairKindFor,
} from './repair.policy';

const NOW = new Date('2025-03-01T00:00:00.000Z');

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    anomalyId: 'a-1',
    teamId: 'team-1',
    ruleKey: DataQualityRule.JerseyConflict,
    ruleVersion: 'dq-v1',
    severity: AnomalySeverity.Warning,
    resourceType: 'reservation' as Anomaly['resourceType'],
    resourceRef: 'ref-1',
    fingerprint: 'fp',
    occurrenceCount: 2,
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

describe('anomaly alert policy', () => {
  it('alerts only for actionable severities', () => {
    expect(isAlertable(AnomalySeverity.Warning)).toBe(true);
    expect(isAlertable(AnomalySeverity.Critical)).toBe(true);
    expect(isAlertable(AnomalySeverity.Info)).toBe(false);
  });

  it('counts alertable detections and fingerprints a finding', () => {
    const first: DetectedAnomaly = {
      ruleKey: DataQualityRule.JerseyConflict,
      resourceType: 'reservation' as never,
      resourceRef: 'r-1',
    };
    const detected: DetectedAnomaly[] = [
      first,
      {
        ruleKey: DataQualityRule.StaleProjection,
        resourceType: 'projection' as never,
        resourceRef: 'p-1',
      },
    ];
    const severityOf = (rule: DataQualityRule): AnomalySeverity =>
      rule === DataQualityRule.JerseyConflict
        ? AnomalySeverity.Warning
        : AnomalySeverity.Info;
    expect(countAlertable(detected, severityOf)).toBe(1);
    expect(fingerprintOf(first)).toContain('jersey_conflict');
  });
});

describe('anomaly state machine', () => {
  it('walks the queue lifecycle and refuses illegal moves', () => {
    expect(anomalyTargetOf(AnomalyTransition.Resolve)).toBe(
      AnomalyStatus.Resolved,
    );
    expect(
      canTransitionAnomaly(AnomalyStatus.Open, AnomalyStatus.Acknowledged),
    ).toBe(true);
    expect(
      canTransitionAnomaly(AnomalyStatus.Resolved, AnomalyStatus.Open),
    ).toBe(true);
    expect(canTransitionAnomaly(AnomalyStatus.Open, AnomalyStatus.Open)).toBe(
      false,
    );
    expect(isResolveTarget(AnomalyStatus.Resolved)).toBe(true);
    expect(isSuppressTarget(AnomalyStatus.Suppressed)).toBe(true);
    expect(isReopenTarget(AnomalyStatus.Open)).toBe(true);
  });

  it('reopens a resolved or expired-suppressed anomaly', () => {
    expect(shouldReopen(AnomalyStatus.Resolved, NOW, null)).toBe(true);
    expect(shouldReopen(AnomalyStatus.Open, NOW, null)).toBe(false);
    expect(
      shouldReopen(
        AnomalyStatus.Suppressed,
        new Date('2025-04-01T00:00:00.000Z'),
        NOW,
      ),
    ).toBe(true);
    expect(
      shouldReopen(
        AnomalyStatus.Suppressed,
        NOW,
        new Date('2025-04-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});

describe('repair policy', () => {
  it('offers a repair only for a supported, actionable anomaly', () => {
    expect(repairKindFor(DataQualityRule.JerseyConflict)).toBe(
      RepairKind.ReleaseJersey,
    );
    expect(repairKindFor(DataQualityRule.AssessmentOutOfScale)).toBeNull();
    expect(isRepairable(anomaly())).toBe(true);
    expect(isRepairable(anomaly({ status: AnomalyStatus.Resolved }))).toBe(
      false,
    );
    expect(
      isRepairable(anomaly({ ruleKey: DataQualityRule.AssessmentOutOfScale })),
    ).toBe(false);
  });

  it('builds a read-only preview and marks reversibility', () => {
    const preview = buildPreview(anomaly(), RepairKind.ReleaseJersey);
    expect(preview.impactCount).toBe(2);
    expect(preview.reversible).toBe(true);
    expect(isReversible(RepairKind.MergeDuplicate)).toBe(false);
    expect(isReversible(RepairKind.ReleaseJersey)).toBe(true);
  });

  it('gates apply and rollback by status and reversibility', () => {
    expect(canApply(RepairStatus.Previewed)).toBe(true);
    expect(canApply(RepairStatus.Applied)).toBe(false);
    expect(canRollback(RepairStatus.Applied, RepairKind.ReleaseJersey)).toBe(
      true,
    );
    expect(canRollback(RepairStatus.Applied, RepairKind.MergeDuplicate)).toBe(
      false,
    );
    expect(canRollback(RepairStatus.Previewed, RepairKind.ReleaseJersey)).toBe(
      false,
    );
  });
});
