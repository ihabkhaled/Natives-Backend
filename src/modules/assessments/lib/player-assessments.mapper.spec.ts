import { describe, expect, it } from 'vitest';

import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  ContextHeadRow,
  PlayerAssessmentRow,
  PlayerAssessmentValueRow,
  TemplateMetricBoundRow,
} from '../model/player-assessments.rows';
import {
  toPlayerAssessment,
  toPlayerAssessmentContext,
  toPlayerAssessmentSummary,
  toPlayerAssessmentValue,
  toPlayerPublishedAssessment,
  toTemplateMetricBound,
} from './player-assessments.mapper';

function assessmentRow(
  overrides: Partial<PlayerAssessmentRow> = {},
): PlayerAssessmentRow {
  return {
    id: 'a1',
    family_id: 'f1',
    team_id: 't1',
    season_id: null,
    period_id: 'p1',
    template_id: 'tm1',
    membership_id: 'm1',
    evaluator_user_id: 'e1',
    status: 'draft',
    revision: 1,
    summary: null,
    record_version: 1,
    submitted_at: null,
    submitted_by: null,
    reviewed_at: null,
    reviewed_by: null,
    published_at: null,
    published_by: null,
    superseded_at: null,
    superseded_by_id: null,
    created_by: 'e1',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: new Date('2026-06-02T00:00:00.000Z'),
    ...overrides,
  };
}

function valueRow(
  overrides: Partial<PlayerAssessmentValueRow> = {},
): PlayerAssessmentValueRow {
  return {
    id: 'v1',
    assessment_id: 'a1',
    metric_definition_id: 'metric-1',
    numeric_value: '3',
    text_value: null,
    note: 'private note',
    confidence: 2,
    observation_count: 4,
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toPlayerAssessment', () => {
  it('maps snake_case rows into the vendor-free aggregate', () => {
    const mapped = toPlayerAssessment(
      assessmentRow({
        status: 'published',
        published_at: '2026-06-03T00:00:00.000Z',
        season_id: 's1',
      }),
    );
    expect(mapped.status).toBe(PlayerAssessmentStatus.Published);
    expect(mapped.seasonId).toBe('s1');
    expect(mapped.publishedAt).toEqual(new Date('2026-06-03T00:00:00.000Z'));
    expect(mapped.updatedAt).toEqual(new Date('2026-06-02T00:00:00.000Z'));
  });

  it('throws on an unrecognized status', () => {
    expect(() =>
      toPlayerAssessment(assessmentRow({ status: 'weird' })),
    ).toThrow(/Unrecognized player assessment status/u);
  });
});

describe('toPlayerAssessmentValue', () => {
  it('converts a numeric string to a number', () => {
    expect(toPlayerAssessmentValue(valueRow()).numericValue).toBe(3);
  });

  it('preserves NULL as not-evaluated (null-not-zero)', () => {
    expect(
      toPlayerAssessmentValue(valueRow({ numeric_value: null })).numericValue,
    ).toBeNull();
  });
});

describe('toPlayerAssessmentSummary', () => {
  it('projects the light list row', () => {
    const summary = toPlayerAssessmentSummary(assessmentRow());
    expect(summary.id).toBe('a1');
    expect(summary.status).toBe(PlayerAssessmentStatus.Draft);
    expect(summary.publishedAt).toBeNull();
  });
});

describe('toPlayerPublishedAssessment', () => {
  it('excludes private notes and confidence from the player view', () => {
    const assessment = toPlayerAssessment(
      assessmentRow({ status: 'published', summary: 'well done' }),
    );
    const view = toPlayerPublishedAssessment(assessment, [
      toPlayerAssessmentValue(valueRow()),
    ]);
    expect(view.summary).toBe('well done');
    expect(view.values).toEqual([
      { metricDefinitionId: 'metric-1', numericValue: 3, textValue: null },
    ]);
    expect(JSON.stringify(view)).not.toContain('private note');
  });
});

describe('toTemplateMetricBound / toPlayerAssessmentContext', () => {
  it('maps bounds and resolves the context head', () => {
    const boundRow: TemplateMetricBoundRow = {
      metric_definition_id: 'metric-1',
      required: true,
      minimum_value: '0',
      maximum_value: '5',
    };
    expect(toTemplateMetricBound(boundRow)).toEqual({
      metricDefinitionId: 'metric-1',
      required: true,
      minimumValue: 0,
      maximumValue: 5,
    });
    const head: ContextHeadRow = { template_id: 'tm1', season_id: 's1' };
    const context = toPlayerAssessmentContext(head, [boundRow]);
    expect(context.templateId).toBe('tm1');
    expect(context.metrics).toHaveLength(1);
  });
});
