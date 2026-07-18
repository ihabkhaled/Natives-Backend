import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentDirection } from '../model/assessments.enums';
import type {
  CategoryRow,
  MetricRow,
  PeriodRow,
  ScaleRow,
  TemplateRow,
} from '../model/assessments.rows';
import { AssessmentCatalogRepository } from './assessment-catalog.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function categoryRow(): CategoryRow {
  return {
    id: 'category-1',
    category_key: 'technical',
    name: 'Technical',
    description: 'Skills',
    sort_order: 10,
    status: 'active',
    version: 1,
    created_at: NOW,
  };
}

function scaleRow(overrides: Partial<ScaleRow> = {}): ScaleRow {
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
    ...overrides,
  };
}

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

function templateRow(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: 'template-1',
    family_id: 'family-1',
    team_id: 'team-1',
    season_id: null,
    template_key: 'midseason',
    name: 'Midseason',
    cohort: null,
    evaluator_roles: ['COACH'],
    score_version: 1,
    status: 'draft',
    template_version: 1,
    record_version: 1,
    published_at: null,
    published_by: null,
    created_by: 'actor-1',
    created_at: NOW,
    ...overrides,
  };
}

function periodRow(): PeriodRow {
  return {
    id: 'period-1',
    team_id: 'team-1',
    season_id: null,
    template_id: 'template-1',
    name: 'Q1',
    cohort: null,
    starts_on: '2026-01-01',
    ends_on: '2026-03-31',
    status: 'active',
    record_version: 1,
    created_by: 'actor-1',
    created_at: NOW,
  };
}

function weightRow() {
  return {
    template_id: 'template-1',
    category_id: 'category-1',
    weight_percentage: 100,
  };
}

function templateMetricRow() {
  return {
    template_id: 'template-1',
    metric_definition_id: 'metric-1',
    required: true,
    sort_order: 0,
  };
}

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new AssessmentCatalogRepository() };
}

describe('AssessmentCatalogRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists active categories with a covering order and count fallback', async () => {
    harness.scope.run
      .mockResolvedValueOnce([categoryRow()])
      .mockResolvedValueOnce([{ count: 3 }]);
    const page = await harness.repository.listCategories(
      harness.scope as never,
      {
        limit: 20,
        offset: 0,
      },
    );
    expect(page.items[0]?.key).toBe('technical');
    expect(page.total).toBe(3);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "sort_order" ASC',
    );
  });

  it('falls back to zero when the category count row is missing', async () => {
    harness.scope.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const page = await harness.repository.listCategories(
      harness.scope as never,
      {
        limit: 20,
        offset: 0,
      },
    );
    expect(page.total).toBe(0);
  });

  it('preserves nullable scale bounds instead of coercing them to zero', async () => {
    harness.scope.run
      .mockResolvedValueOnce([
        scaleRow({ maximum_value: null, step_value: null }),
      ])
      .mockResolvedValueOnce([{ count: 1 }]);
    const page = await harness.repository.listScales(harness.scope as never, {
      limit: 20,
      offset: 0,
    });
    expect(page.items[0]?.minimumValue).toBe(0);
    expect(page.items[0]?.maximumValue).toBeNull();
    expect(page.items[0]?.stepValue).toBeNull();
  });

  it('lists only current active global/team metrics with bounded stable paging', async () => {
    harness.scope.run
      .mockResolvedValueOnce([metricRow()])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await harness.repository.listMetrics(
      harness.scope as never,
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

  it('reports zero metrics when the count row is missing', async () => {
    harness.scope.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await harness.repository.listMetrics(
      harness.scope as never,
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(result.total).toBe(0);
  });

  it('probes metric key existence', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'metric-1' }]);
    await expect(
      harness.repository.metricKeyExists(harness.scope as never, 'team-1', 'k'),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.metricKeyExists(harness.scope as never, 'team-1', 'k'),
    ).resolves.toBe(false);
  });

  it('confirms a category+scale reference pair only when both are active', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.referencesExist(harness.scope as never, 'c', 's'),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      harness.repository.referencesExist(harness.scope as never, 'c', 's'),
    ).resolves.toBe(false);
  });

  it('finds a metric for write within team scope, else null', async () => {
    harness.scope.run.mockResolvedValueOnce([metricRow()]);
    await expect(
      harness.repository.findMetricForWrite(
        harness.scope as never,
        'team-1',
        'metric-1',
      ),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findMetricForWrite(
        harness.scope as never,
        'team-1',
        'missing',
      ),
    ).resolves.toBeNull();
  });

  it('computes the next metric version, defaulting to 1', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 3 }]);
    await expect(
      harness.repository.nextMetricVersion(harness.scope as never, 'family-1'),
    ).resolves.toBe(3);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.nextMetricVersion(harness.scope as never, 'family-1'),
    ).resolves.toBe(1);
  });

  it('inserts a parameterized metric version and maps the returned row', async () => {
    harness.scope.run.mockResolvedValueOnce([
      metricRow({ definition_version: 2 }),
    ]);
    const created = await harness.repository.insertMetric(
      harness.scope as never,
      {
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
      },
    );
    expect(created.version).toBe(2);
    expect(harness.scope.run.mock.calls[0]?.[1]).toContain('team-1');
    expect(String(harness.scope.run.mock.calls[0]?.[0])).not.toContain(
      'team-1',
    );
  });

  it('throws when an insert returns no row', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insertMetric(harness.scope as never, {
        id: 'metric-2',
        familyId: 'family-1',
        teamId: 'team-1',
        categoryId: 'category-1',
        scaleId: 'scale-1',
        key: 'custom_speed',
        name: 'Custom speed',
        definition: 'x',
        direction: AssessmentDirection.HigherIsBetter,
        guidance: 'y',
        applicability: [],
        tags: [],
        version: 1,
        createdBy: 'actor-1',
        now: NOW,
      }),
    ).rejects.toThrow(/returned row/u);
  });

  it('detects a metric referenced by a template', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'template-1' }]);
    await expect(
      harness.repository.metricInUse(harness.scope as never, 'metric-1'),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.metricInUse(harness.scope as never, 'metric-1'),
    ).resolves.toBe(false);
  });

  it('archives only the matching team and optimistic record version', async () => {
    harness.scope.run.mockResolvedValueOnce([
      metricRow({ status: 'archived', record_version: 2 }),
    ]);
    const result = await harness.repository.archiveMetric(
      harness.scope as never,
      {
        id: 'metric-1',
        teamId: 'team-1',
        expectedRecordVersion: 1,
        archivedBy: 'actor-1',
        now: NOW,
      },
    );
    expect(result?.recordVersion).toBe(2);
    const query = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(query).toContain('"team_id" = $2');
    expect(query).toContain('"record_version" = $5');
  });

  it('returns null when an archive matches nothing', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.archiveMetric(harness.scope as never, {
        id: 'metric-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        archivedBy: 'actor-1',
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('probes template key existence and next version', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'template-1' }]);
    await expect(
      harness.repository.templateKeyExists(
        harness.scope as never,
        'team-1',
        'k',
      ),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.templateKeyExists(
        harness.scope as never,
        'team-1',
        'k',
      ),
    ).resolves.toBe(false);
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.nextTemplateVersion(
        harness.scope as never,
        'family-1',
      ),
    ).resolves.toBe(2);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.nextTemplateVersion(
        harness.scope as never,
        'family-1',
      ),
    ).resolves.toBe(1);
  });

  it('confirms template references only when every id is active', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.templateReferencesExist(
        harness.scope as never,
        'team-1',
        [{ categoryId: 'category-1', weightPercentage: 100 }],
        [{ metricDefinitionId: 'metric-1', required: true, sortOrder: 0 }],
      ),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      harness.repository.templateReferencesExist(
        harness.scope as never,
        'team-1',
        [{ categoryId: 'category-1', weightPercentage: 100 }],
        [{ metricDefinitionId: 'metric-1', required: true, sortOrder: 0 }],
      ),
    ).resolves.toBe(false);
  });

  it('loads a template with its ordered weights and metrics, else null', async () => {
    harness.scope.run
      .mockResolvedValueOnce([templateRow()])
      .mockResolvedValueOnce([weightRow()])
      .mockResolvedValueOnce([templateMetricRow()]);
    const found = await harness.repository.findTemplateForWrite(
      harness.scope as never,
      'team-1',
      'template-1',
    );
    expect(found?.categoryWeights).toHaveLength(1);
    expect(found?.metrics).toHaveLength(1);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findTemplateForWrite(
        harness.scope as never,
        'team-1',
        'missing',
      ),
    ).resolves.toBeNull();
  });

  it('inserts a template with relations and reloads the full aggregate', async () => {
    harness.scope.run
      .mockResolvedValueOnce([templateRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([weightRow()])
      .mockResolvedValueOnce([templateMetricRow()]);
    const created = await harness.repository.insertTemplate(
      harness.scope as never,
      {
        id: 'template-1',
        familyId: 'template-1',
        teamId: 'team-1',
        seasonId: null,
        key: 'midseason',
        name: 'Midseason',
        cohort: null,
        evaluatorRoles: ['COACH'] as never,
        scoreVersion: 1,
        version: 1,
        createdBy: 'actor-1',
        now: NOW,
      },
      [{ categoryId: 'category-1', weightPercentage: 100 }],
      [{ metricDefinitionId: 'metric-1', required: true, sortOrder: 0 }],
    );
    expect(created.categoryWeights).toHaveLength(1);
    expect(created.metrics).toHaveLength(1);
  });

  it('publishes a draft and reloads it, else null', async () => {
    harness.scope.run
      .mockResolvedValueOnce([
        templateRow({ status: 'published', published_at: NOW }),
      ])
      .mockResolvedValueOnce([weightRow()])
      .mockResolvedValueOnce([templateMetricRow()]);
    const published = await harness.repository.publishTemplate(
      harness.scope as never,
      {
        id: 'template-1',
        teamId: 'team-1',
        expectedRecordVersion: 1,
        publishedBy: 'actor-1',
        now: NOW,
      },
    );
    expect(published?.status).toBe('published');

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.publishTemplate(harness.scope as never, {
        id: 'template-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        publishedBy: 'actor-1',
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('lists templates with relations and an empty-page fallback', async () => {
    harness.scope.run
      .mockResolvedValueOnce([templateRow()])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([weightRow()])
      .mockResolvedValueOnce([templateMetricRow()]);
    const page = await harness.repository.listTemplates(
      harness.scope as never,
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(page.total).toBe(1);
    expect(page.items[0]?.categoryWeights).toHaveLength(1);

    harness.scope.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const empty = await harness.repository.listTemplates(
      harness.scope as never,
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(empty.total).toBe(0);
    expect(empty.items).toHaveLength(0);
  });

  it('detects a published template in team scope', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'template-1' }]);
    await expect(
      harness.repository.publishedTemplateExists(
        harness.scope as never,
        'team-1',
        'template-1',
      ),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.publishedTemplateExists(
        harness.scope as never,
        'team-1',
        'template-1',
      ),
    ).resolves.toBe(false);
  });

  it('inserts a period and maps the date-only window', async () => {
    harness.scope.run.mockResolvedValueOnce([periodRow()]);
    const created = await harness.repository.insertPeriod(
      harness.scope as never,
      {
        id: 'period-1',
        teamId: 'team-1',
        seasonId: null,
        templateId: 'template-1',
        name: 'Q1',
        cohort: null,
        startsOn: '2026-01-01',
        endsOn: '2026-03-31',
        createdBy: 'actor-1',
        now: NOW,
      },
    );
    expect(created.startsOn).toBe('2026-01-01');
  });

  it('lists periods ordered by window with a count fallback', async () => {
    harness.scope.run
      .mockResolvedValueOnce([periodRow()])
      .mockResolvedValueOnce([{ count: 1 }]);
    const page = await harness.repository.listPeriods(
      harness.scope as never,
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(page.total).toBe(1);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "starts_on" ASC',
    );

    harness.scope.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const empty = await harness.repository.listPeriods(
      harness.scope as never,
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(empty.total).toBe(0);
  });
});
