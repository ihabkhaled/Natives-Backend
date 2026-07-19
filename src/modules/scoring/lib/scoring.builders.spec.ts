import { describe, expect, it } from 'vitest';

import {
  PROJECTION_REBUILT_EVENT,
  PROJECTION_REQUESTED_EVENT,
  RULE_CREATED_ACTION,
  RULE_CREATED_EVENT,
  RULE_PUBLISHED_EVENT,
  RULE_RETIRED_EVENT,
} from '../model/scoring.constants';
import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { CategorySourceRow } from '../model/scoring.rows';
import type {
  CalculationRule,
  CategorySource,
  ProjectionTarget,
  RebuildOutcome,
  RuleContent,
} from '../model/scoring.types';
import {
  buildCategoryInputs,
  buildNewRule,
  buildProjectionRebuiltEvent,
  buildProjectionRequestedEvent,
  buildRebuildAudit,
  buildRuleAudit,
  buildRuleCreatedEvent,
  buildRulePublishedEvent,
  buildRuleRetiredEvent,
  buildStatusChange,
  computeMembershipProjection,
  groupSourcesByMembership,
  indexAttendanceByMembership,
  toAttendanceCategorySource,
  withAttendanceSource,
} from './scoring.builders';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function rule(overrides: Partial<CalculationRule> = {}): CalculationRule {
  return {
    ruleId: 'rule-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    ruleKey: 'legacy_overall',
    version: 2,
    name: 'Legacy overall',
    description: null,
    status: CalculationRuleStatus.Published,
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    components: [
      { categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 },
      { categoryKey: ScoreCategory.Attendance, weight: 1, minSample: 1 },
    ],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 4,
    createdBy: 'admin-1',
    publishedBy: 'admin-1',
    publishedAt: NOW,
    retiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const TARGET: ProjectionTarget = {
  id: 'proj-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  membershipId: 'mem-1',
  periodId: null,
};

describe('buildCategoryInputs', () => {
  it('averages present metrics and nulls categories with no source', () => {
    const sources: readonly CategorySource[] = [
      { categoryKey: ScoreCategory.Training, values: [4, 2], totalMetrics: 3 },
    ];
    const inputs = buildCategoryInputs(rule(), sources);
    const training = inputs.find(i => i.categoryKey === ScoreCategory.Training);
    expect(training?.value).toBe(3);
    expect(training?.assessedMetrics).toBe(2);
    expect(training?.totalMetrics).toBe(3);
    const attendance = inputs.find(
      i => i.categoryKey === ScoreCategory.Attendance,
    );
    expect(attendance?.value).toBeNull();
    expect(attendance?.totalMetrics).toBe(0);
  });
});

describe('computeMembershipProjection', () => {
  it('produces a projection with an explanation and a source hash', () => {
    const projection = computeMembershipProjection(
      rule(),
      TARGET,
      [{ categoryKey: ScoreCategory.Training, values: [4], totalMetrics: 1 }],
      NOW,
    );
    expect(projection.result.value).toBe(4);
    expect(projection.explanation.rule.ruleId).toBe('rule-1');
    expect(projection.sourceHash).toHaveLength(64);
    expect(projection.membershipId).toBe('mem-1');
  });
});

describe('buildStatusChange', () => {
  it('stamps publication for a publish target', () => {
    const change = buildStatusChange(
      rule({ publishedAt: null, publishedBy: null }),
      'team-1',
      CalculationRuleStatus.Published,
      'admin-9',
      4,
      NOW,
    );
    expect(change.publishedBy).toBe('admin-9');
    expect(change.publishedAt).toBe(NOW);
    expect(change.retiredAt).toBeNull();
  });

  it('stamps retirement and keeps the publication trail', () => {
    const change = buildStatusChange(
      rule(),
      'team-1',
      CalculationRuleStatus.Retired,
      'admin-9',
      4,
      NOW,
    );
    expect(change.retiredAt).toBe(NOW);
    expect(change.publishedBy).toBe('admin-1');
  });

  it('touches neither trail for an approve target', () => {
    const change = buildStatusChange(
      rule({ publishedAt: null, publishedBy: null }),
      'team-1',
      CalculationRuleStatus.Approved,
      'admin-9',
      4,
      NOW,
    );
    expect(change.publishedBy).toBeNull();
    expect(change.publishedAt).toBeNull();
    expect(change.retiredAt).toBeNull();
  });
});

describe('groupSourcesByMembership', () => {
  it('groups rows into typed sources per membership', () => {
    const rows: readonly CategorySourceRow[] = [
      {
        membership_id: 'mem-1',
        category_key: 'training',
        values: ['4'],
        total_metrics: 1,
      },
      {
        membership_id: 'mem-1',
        category_key: 'technical',
        values: ['3'],
        total_metrics: 1,
      },
      {
        membership_id: 'mem-2',
        category_key: 'training',
        values: [],
        total_metrics: 2,
      },
    ];
    const grouped = groupSourcesByMembership(rows);
    expect(grouped.get('mem-1')).toHaveLength(2);
    expect(grouped.get('mem-2')).toHaveLength(1);
  });
});

describe('attendance sourcing', () => {
  it('normalizes the attended fraction onto the 0–5 scale (excused excluded)', () => {
    const source = toAttendanceCategorySource({
      membershipId: 'mem-1',
      attendedEligible: 3,
      absentCount: 1,
      excusedSessions: 2,
    });
    expect(source.categoryKey).toBe(ScoreCategory.Attendance);
    // 3 / (3 + 1) = 0.75 -> 0.75 * 5 = 3.75.
    expect(source.values).toEqual([3.75]);
    expect(source.totalMetrics).toBe(1);
  });

  it('yields an empty value (null attendance) when no session is eligible', () => {
    const source = toAttendanceCategorySource({
      membershipId: 'mem-1',
      attendedEligible: 0,
      absentCount: 0,
      excusedSessions: 3,
    });
    expect(source.values).toEqual([]);
    expect(source.totalMetrics).toBe(1);
  });

  it('appends attendance only when counts are present', () => {
    const base: readonly CategorySource[] = [
      { categoryKey: ScoreCategory.Training, values: [4], totalMetrics: 1 },
    ];
    expect(withAttendanceSource(base, undefined)).toBe(base);
    const merged = withAttendanceSource(base, {
      membershipId: 'mem-1',
      attendedEligible: 2,
      absentCount: 2,
      excusedSessions: 0,
    });
    expect(merged).toHaveLength(2);
    expect(merged[1]?.categoryKey).toBe(ScoreCategory.Attendance);
  });

  it('indexes attendance rows by membership id', () => {
    const map = indexAttendanceByMembership([
      { membership_id: 'mem-1', attended: 1, absent: 0, excused: 0 },
      { membership_id: 'mem-2', attended: 0, absent: 2, excused: 1 },
    ]);
    expect(map.get('mem-1')?.attendedEligible).toBe(1);
    expect(map.get('mem-2')?.absentCount).toBe(2);
    expect(map.get('mem-2')?.excusedSessions).toBe(1);
  });
});

describe('audit and event builders', () => {
  it('builds a rule audit and the rule lifecycle events', () => {
    const audit = buildRuleAudit(RULE_CREATED_ACTION, 'admin-1', rule());
    expect(audit.action).toBe(RULE_CREATED_ACTION);
    expect(audit.resourceId).toBe('rule-1');
    expect(buildRuleCreatedEvent(rule(), 'admin-1').eventType).toBe(
      RULE_CREATED_EVENT,
    );
    expect(buildRulePublishedEvent(rule(), 'admin-1').eventType).toBe(
      RULE_PUBLISHED_EVENT,
    );
    expect(buildRuleRetiredEvent(rule(), 'admin-1').eventType).toBe(
      RULE_RETIRED_EVENT,
    );
    expect(buildProjectionRequestedEvent(rule(), 'admin-1').eventType).toBe(
      PROJECTION_REQUESTED_EVENT,
    );
  });

  it('builds the rebuild audit and event from an outcome', () => {
    const outcome: RebuildOutcome = {
      scanned: 3,
      rebuilt: 2,
      failed: 1,
      ruleId: 'rule-1',
      ruleVersion: 2,
    };
    const audit = buildRebuildAudit(
      'rebuild',
      'admin-1',
      outcome,
      'team-1',
      null,
    );
    expect(audit.diff.rebuilt).toBe(2);
    const event = buildProjectionRebuiltEvent(
      'admin-1',
      'team-1',
      null,
      outcome,
    );
    expect(event.eventType).toBe(PROJECTION_REBUILT_EVENT);
    expect(event.payload.failed).toBe(1);
  });
});

describe('buildNewRule', () => {
  it('wraps content with the generated id and version', () => {
    const content = { ruleKey: 'k' } as RuleContent;
    const built = buildNewRule('id-1', 'team-1', 3, content, 'admin-1', NOW);
    expect(built).toEqual({
      id: 'id-1',
      teamId: 'team-1',
      version: 3,
      content,
      createdBy: 'admin-1',
      now: NOW,
    });
  });
});
