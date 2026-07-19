import { computeAttendancePercentage } from '@modules/scoring/domain/attendance-score.engine';
import {
  computeMembershipProjection,
  toAttendanceCategorySource,
  withAttendanceSource,
} from '@modules/scoring/lib/scoring.builders';
import { ScoreCategory } from '@modules/scoring/model/scoring.enums';
import type {
  AttendanceCounts,
  CalculationRule,
  CategorySource,
  ProjectionTarget,
  RuleComponent,
} from '@modules/scoring/model/scoring.types';
import { describe, expect, it } from 'vitest';

/**
 * GOLDEN calculation tests. Each fixture pins the rule version, the raw inputs,
 * the exclusions, the coverage, the UNROUNDED and DISPLAYED result, and the full
 * explanation components — exercised through the real projection + explanation
 * pipeline. Measured zero is distinguished from missing; excused attendance is
 * excluded from the denominator; no eligible session yields null, never 0%.
 */

const NOW = new Date('2026-06-01T12:00:00.000Z');

const TARGET: ProjectionTarget = {
  id: 'proj-golden',
  teamId: 'team-1',
  seasonId: null,
  membershipId: 'mem-1',
  periodId: null,
};

function component(categoryKey: ScoreCategory): RuleComponent {
  return { categoryKey, weight: 1, minSample: 1 };
}

function rule(
  version: number,
  components: readonly RuleComponent[],
  minComponents = 1,
): CalculationRule {
  return {
    ruleId: 'rule-golden',
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'legacy_overall',
    version,
    name: 'Legacy equal-weight overall',
    description: null,
    status: 'published' as CalculationRule['status'],
    scaleMin: 0,
    scaleMax: 5,
    minComponents,
    components,
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 1,
    createdBy: null,
    publishedBy: null,
    publishedAt: NOW,
    retiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('golden: equal-weight overall with a normalized attendance component', () => {
  it('projects the mean of Technical and Attendance with a full explanation', () => {
    // Rule v3; raw: Technical [4, 2] of 3 metrics (1 missing); attendance 3 of 4
    // eligible (2 excused excluded) -> 0.75 -> normalized 3.75 on the 0-5 scale.
    const sources: readonly CategorySource[] = [
      { categoryKey: ScoreCategory.Technical, values: [4, 2], totalMetrics: 3 },
    ];
    const attendance: AttendanceCounts = {
      membershipId: 'mem-1',
      attendedEligible: 3,
      absentCount: 1,
      excusedSessions: 2,
    };
    const merged = withAttendanceSource(sources, attendance);
    const projection = computeMembershipProjection(
      rule(3, [
        component(ScoreCategory.Technical),
        component(ScoreCategory.Attendance),
      ]),
      TARGET,
      merged,
      NOW,
    );
    const explanation = projection.explanation;
    expect(explanation.rule.version).toBe(3);
    expect(explanation.formulaVersion).toBe(3);
    // numerator = 3 (technical mean) + 3.75 (attendance) = 6.75; denominator = 2.
    expect(explanation.overall.numerator).toBe(6.75);
    expect(explanation.overall.denominator).toBe(2);
    expect(explanation.overall.unrounded).toBe(3.375);
    expect(explanation.overall.display).toBe(3.38); // rounded only at the boundary
    expect(explanation.overall.excludedCount).toBe(0);
    expect(explanation.completeness).toBe(1);
    expect(explanation.confidence).toBe('high');
    const technical = explanation.components.find(
      c => c.categoryKey === ScoreCategory.Technical,
    );
    expect(technical).toMatchObject({
      included: true,
      unrounded: 3,
      display: 3,
      assessedMetrics: 2,
      totalMetrics: 3,
      excludedReason: null,
    });
    const attendanceComponent = explanation.components.find(
      c => c.categoryKey === ScoreCategory.Attendance,
    );
    expect(attendanceComponent).toMatchObject({
      included: true,
      unrounded: 3.75,
      display: 3.75,
    });
  });
});

describe('golden: measured zero is included, missing is excluded', () => {
  it('keeps a real 0 in the mean and names the missing category', () => {
    const sources: readonly CategorySource[] = [
      { categoryKey: ScoreCategory.Technical, values: [0], totalMetrics: 1 },
    ];
    const projection = computeMembershipProjection(
      rule(1, [
        component(ScoreCategory.Technical),
        component(ScoreCategory.Physical),
      ]),
      TARGET,
      sources,
      NOW,
    );
    const explanation = projection.explanation;
    expect(explanation.overall.unrounded).toBe(0); // measured zero, not null
    expect(explanation.overall.display).toBe(0);
    expect(explanation.overall.numerator).toBe(0);
    expect(explanation.overall.denominator).toBe(1);
    expect(explanation.overall.includedCount).toBe(1);
    expect(explanation.overall.excludedCount).toBe(1);
    expect(explanation.completeness).toBe(0.5);
    const physical = explanation.components.find(
      c => c.categoryKey === ScoreCategory.Physical,
    );
    expect(physical?.included).toBe(false);
    expect(physical?.unrounded).toBeNull();
    expect(physical?.excludedReason).toBe('no assessed data for this category');
  });
});

describe('golden: no eligible attendance yields null, never 0%', () => {
  it('excludes an all-excused attendance and withholds the overall', () => {
    // 0 attended, 0 absent, 3 excused -> denominator 0 -> percentage null.
    const percentage = computeAttendancePercentage({
      attendedEligible: 0,
      eligibleSessions: 3,
      excusedSessions: 3,
    });
    expect(percentage.value).toBeNull();
    expect(percentage.denominator).toBe(0);

    const source = toAttendanceCategorySource({
      membershipId: 'mem-1',
      attendedEligible: 0,
      absentCount: 0,
      excusedSessions: 3,
    });
    const projection = computeMembershipProjection(
      rule(1, [component(ScoreCategory.Attendance)]),
      TARGET,
      [source],
      NOW,
    );
    const explanation = projection.explanation;
    expect(explanation.overall.unrounded).toBeNull(); // not enough data
    expect(explanation.overall.display).toBeNull();
    expect(explanation.overall.includedCount).toBe(0);
    expect(explanation.confidence).toBe('none');
    const attendanceComponent = explanation.components[0];
    expect(attendanceComponent?.included).toBe(false);
    expect(attendanceComponent?.excludedReason).toBe(
      'no assessed data for this category',
    );
  });
});
