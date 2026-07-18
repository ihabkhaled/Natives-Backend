import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentDirection } from '../model/assessments.enums';
import type { MetricRow, ScaleRow } from '../model/assessments.rows';
import { AssessmentCatalogRepository } from './assessment-catalog.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function metricRow(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: 'metric-1',
    family_id: 'family-1',
    team_id: 'team-1',
    category_id: 'category-1',
    scale_id: 'scale-1',
    definition_key: 'custom_speed',
    name: 'Custom speed',
    definition: 'Observed acceleration quality.',
    direction: AssessmentDirection.HigherIsBetter,
    guidance: 'Use observed behavior.',
    applicability: ['player'],
    tags: ['physical'],
    status: 'active',
    definition_version: 1,
    record_version: 1,
    created_by: 'actor-1',
    archived_by: null,
    created_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function scaleRow(): ScaleRow {
  return {
    id: 'scale-1',
    scale_key: 'percentage',
    name: 'Percentage',
    value_kind: 'percentage',
    unit: 'percent',
    minimum_value: '0',
    maximum_value: '100',
    step_value: '0.01',
    categorical_options: [],
    guidance: 'Observed percentage.',
    status: 'active',
    scale_version: 1,
    created_at: NOW,
  };
}

function build() {
  const scope = { run: vi.fn() };
  return {
    scope,
    repository: new AssessmentCatalogRepository(),
  };
}

describe('AssessmentCatalogRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists only current active global/team metrics with bounded stable paging', async () => {
    harness.scope.run
      .mockResolvedValueOnce([metricRow()])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await harness.repository.listMetrics(
      harness.scope,
      'team-1',
      { limit: 20, offset: 40 },
    );
    expect(result.items[0]?.key).toBe('custom_speed');
    expect(result.total).toBe(1);
    const query = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(query).toContain('"team_id" IS NULL OR m."team_id" = $1');
    expect(query).toContain('NOT EXISTS');
    expect(query).toContain('ORDER BY m."definition_key" ASC');
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual(['team-1', 20, 40]);
  });

  it('preserves nullable scale bounds instead of coercing them to zero', async () => {
    harness.scope.run
      .mockResolvedValueOnce([
        { ...scaleRow(), maximum_value: null, step_value: null },
      ])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await harness.repository.listScales(harness.scope, {
      limit: 20,
      offset: 0,
    });
    expect(result.items[0]?.minimumValue).toBe(0);
    expect(result.items[0]?.maximumValue).toBeNull();
    expect(result.items[0]?.stepValue).toBeNull();
  });

  it('inserts a parameterized metric version and maps the returned row', async () => {
    harness.scope.run.mockResolvedValue([metricRow({ definition_version: 2 })]);
    const created = await harness.repository.insertMetric(harness.scope, {
      id: 'metric-2',
      familyId: 'family-1',
      teamId: 'team-1',
      categoryId: 'category-1',
      scaleId: 'scale-1',
      key: 'custom_speed',
      name: 'Custom speed v2',
      definition: 'Observed acceleration and first-step quality.',
      direction: AssessmentDirection.HigherIsBetter,
      guidance: 'Observe in games.',
      applicability: ['player'],
      tags: ['physical'],
      version: 2,
      createdBy: 'actor-1',
      now: NOW,
    });
    expect(created.version).toBe(2);
    expect(harness.scope.run.mock.calls[0]?.[1]).toContain('team-1');
    expect(String(harness.scope.run.mock.calls[0]?.[0])).not.toContain(
      'team-1',
    );
  });

  it('archives only the matching team and optimistic record version', async () => {
    harness.scope.run.mockResolvedValue([
      metricRow({ status: 'archived', record_version: 2 }),
    ]);
    const result = await harness.repository.archiveMetric(harness.scope, {
      id: 'metric-1',
      teamId: 'team-1',
      expectedRecordVersion: 1,
      archivedBy: 'actor-1',
      now: NOW,
    });
    expect(result?.recordVersion).toBe(2);
    const query = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(query).toContain('"team_id" = $2');
    expect(query).toContain('"record_version" = $5');
  });
});

