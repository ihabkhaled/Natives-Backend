import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { AssessmentCatalogSchema1722300000000 } from './1722300000000-assessment-catalog-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('AssessmentCatalogSchema1722300000000', () => {
  it('creates versioned catalog, template, period, and reference tables', async () => {
    const queryRunner = runner();
    await new AssessmentCatalogSchema1722300000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"assessment_metric_categories"');
    expect(statements).toContain('"assessment_scales"');
    expect(statements).toContain('"assessment_metric_definitions"');
    expect(statements).toContain('"assessment_templates"');
    expect(statements).toContain('"assessment_template_category_weights"');
    expect(statements).toContain('"assessment_template_metrics"');
    expect(statements).toContain('"assessment_periods"');
    expect(statements).toContain('"definition_version" integer NOT NULL');
    expect(statements).toContain('"weight_percentage" integer NOT NULL');
  });

  it('seeds all audited categories, six scale kinds, and required metrics', async () => {
    const queryRunner = runner();
    await new AssessmentCatalogSchema1722300000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    for (const category of [
      'technical',
      'tactical',
      'physical',
      'psychological',
      'behavioral',
      'training',
      'custom',
    ]) {
      expect(statements).toContain(`'${category}'`);
    }
    for (const metric of [
      'handling',
      'short_throws',
      'stack_formation',
      'reaction',
      'spirit',
      'leadership',
    ]) {
      expect(statements).toContain(`'${metric}'`);
    }
    for (const kind of [
      'legacy_0_5',
      'timed',
      'count',
      'percentage',
      'categorical',
      'text',
    ]) {
      expect(statements).toContain(`'${kind}'`);
    }
  });

  it('drops only this additive schema and its guard functions', async () => {
    const queryRunner = runner();
    await new AssessmentCatalogSchema1722300000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "assessment_periods"',
      'DROP TABLE IF EXISTS "assessment_template_metrics"',
      'DROP TABLE IF EXISTS "assessment_template_category_weights"',
      'DROP TABLE IF EXISTS "assessment_templates"',
      'DROP TABLE IF EXISTS "assessment_metric_definitions"',
      'DROP TABLE IF EXISTS "assessment_scales"',
      'DROP TABLE IF EXISTS "assessment_metric_categories"',
      'DROP FUNCTION IF EXISTS "guard_used_assessment_metric"()',
      'DROP FUNCTION IF EXISTS "guard_published_assessment_template"()',
    ]);
  });
});
