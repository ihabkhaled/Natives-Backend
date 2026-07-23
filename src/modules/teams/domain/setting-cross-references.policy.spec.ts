import { describe, expect, it } from 'vitest';

import type {
  AttendanceStatusesValue,
  AttendanceWeightsValue,
  RosterLimitsValue,
} from '../model/setting-values.types';
import {
  collectRosterCrossReferenceIssues,
  collectSnapshotIssues,
  collectWeightsCrossReferenceIssues,
} from './setting-cross-references.policy';
import { validateAttendanceStatusesValue } from './setting-value.policy';

function statusesValue(): AttendanceStatusesValue {
  const parsed = validateAttendanceStatusesValue({
    statuses: [
      {
        code: 'present_on_time',
        labelEn: 'On time',
        labelAr: 'في الموعد',
        color: 'success',
        countsTowardMetrics: true,
        allowSelfCheckIn: true,
        active: true,
      },
      {
        code: 'present_late',
        labelEn: 'Late',
        labelAr: 'متأخر',
        color: 'warning',
        countsTowardMetrics: true,
        allowSelfCheckIn: true,
        active: true,
      },
      {
        code: 'excused',
        labelEn: 'Excused',
        labelAr: 'معذور',
        color: 'neutral',
        countsTowardMetrics: false,
        allowSelfCheckIn: false,
        active: true,
      },
      {
        code: 'remote_approved',
        labelEn: 'Remote',
        labelAr: 'عن بعد',
        color: 'accent1',
        countsTowardMetrics: true,
        allowSelfCheckIn: false,
        active: false,
      },
      {
        code: 'absent',
        labelEn: 'Absent',
        labelAr: 'غائب',
        color: 'danger',
        countsTowardMetrics: true,
        allowSelfCheckIn: false,
        active: true,
      },
    ],
  });
  if (!parsed.ok) {
    throw new Error('fixture statuses must be valid');
  }
  return parsed.value;
}

function weights(
  record: Readonly<Record<string, number>>,
): AttendanceWeightsValue {
  return { weights: record };
}

const COVERING_WEIGHTS = weights({
  present_on_time: 1,
  present_late: 0.5,
  absent: 0,
});

describe('setting-cross-references.policy', () => {
  describe('weights vs statuses (write time, D3)', () => {
    it('accepts full coverage of active counts-toward statuses', () => {
      expect(
        collectWeightsCrossReferenceIssues(COVERING_WEIGHTS, statusesValue()),
      ).toEqual([]);
    });

    it('rejects weights when no statuses are configured at the instant', () => {
      const issues = collectWeightsCrossReferenceIssues(COVERING_WEIGHTS, null);
      expect(issues.map(issue => issue.constraint)).toContain(
        'statuses_not_configured',
      );
    });

    it('rejects a weight keyed by an unknown status code', () => {
      const issues = collectWeightsCrossReferenceIssues(
        weights({ ...COVERING_WEIGHTS.weights, vibing: 0.4 }),
        statusesValue(),
      );
      expect(issues.map(issue => issue.constraint)).toContain(
        'weights_unknown_status:vibing',
      );
    });

    it('rejects a weight keyed by an inactive status code', () => {
      const issues = collectWeightsCrossReferenceIssues(
        weights({ ...COVERING_WEIGHTS.weights, remote_approved: 0.8 }),
        statusesValue(),
      );
      expect(issues.map(issue => issue.constraint)).toContain(
        'weights_unknown_status:remote_approved',
      );
    });

    it('rejects missing coverage of an active counts-toward status', () => {
      const issues = collectWeightsCrossReferenceIssues(
        weights({ present_on_time: 1, absent: 0 }),
        statusesValue(),
      );
      expect(issues.map(issue => issue.constraint)).toContain(
        'weights_missing_status:present_late',
      );
    });

    it('does not require coverage of non-counting or inactive statuses', () => {
      const issues = collectWeightsCrossReferenceIssues(
        COVERING_WEIGHTS,
        statusesValue(),
      );
      const constraints = issues.map(issue => issue.constraint);
      expect(constraints).not.toContain('weights_missing_status:excused');
      expect(constraints).not.toContain(
        'weights_missing_status:remote_approved',
      );
    });

    it('rejects an inverted weighting (absent above a present-family weight)', () => {
      const issues = collectWeightsCrossReferenceIssues(
        weights({ present_on_time: 0.2, present_late: 0.5, absent: 1 }),
        statusesValue(),
      );
      expect(issues.map(issue => issue.constraint)).toContain(
        'absent_weight_exceeds_present',
      );
    });

    it('allows an unweighted absent status to skip the inversion rule', () => {
      const issues = collectWeightsCrossReferenceIssues(
        weights({ present_on_time: 1, present_late: 0.5 }),
        statusesValue(),
      );
      expect(issues.map(issue => issue.constraint)).not.toContain(
        'absent_weight_exceeds_present',
      );
    });
  });

  describe('roster positions vs catalog (write time)', () => {
    const rosterValue: RosterLimitsValue = {
      roster: { max: 27 },
      perPosition: [
        { positionKey: 'handler', max: 8 },
        { positionKey: 'cutter', max: 12 },
      ],
    };

    it('accepts per-position keys that are active catalog entries', () => {
      expect(
        collectRosterCrossReferenceIssues(rosterValue, ['handler', 'cutter']),
      ).toEqual([]);
    });

    it('rejects a per-position key missing from the active catalog', () => {
      const issues = collectRosterCrossReferenceIssues(rosterValue, [
        'handler',
      ]);
      expect(issues.map(issue => issue.constraint)).toEqual([
        'unknown_position:cutter',
      ]);
    });

    it('skips the check when no per-position limits are present', () => {
      expect(
        collectRosterCrossReferenceIssues({ roster: { max: 27 } }, []),
      ).toEqual([]);
    });
  });

  describe('snapshot surfacing (read time, D3)', () => {
    it('returns no issues when weights are not configured', () => {
      expect(collectSnapshotIssues(statusesValue(), null)).toEqual([]);
      expect(collectSnapshotIssues(null, null)).toEqual([]);
    });

    it('surfaces statuses_not_configured when only weights exist', () => {
      expect(collectSnapshotIssues(null, COVERING_WEIGHTS)).toEqual([
        'statuses_not_configured',
      ]);
    });

    it('surfaces missing coverage after a later statuses change', () => {
      const issues = collectSnapshotIssues(
        statusesValue(),
        weights({ present_on_time: 1, absent: 0 }),
      );
      expect(issues).toContain('weights_missing_status:present_late');
    });

    it('surfaces unknown codes after a status is archived', () => {
      const issues = collectSnapshotIssues(
        statusesValue(),
        weights({ ...COVERING_WEIGHTS.weights, remote_approved: 0.8 }),
      );
      expect(issues).toContain('weights_unknown_status:remote_approved');
    });
  });
});
