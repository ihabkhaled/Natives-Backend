import { describe, expect, it } from 'vitest';

import { AssessmentIncompleteError } from '../errors/assessment-incomplete.error';
import { AssessmentSelfApprovalError } from '../errors/assessment-self-approval.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import type {
  AssessmentValueInput,
  TemplateMetricBound,
} from '../model/player-assessments.types';
import {
  assertComplete,
  assertReviewerIndependence,
  assertValuesAgainstTemplate,
  isMeasured,
} from './player-assessment.policy';

const METRIC_A = '00000000-0000-4000-8000-00000000000a';
const METRIC_B = '00000000-0000-4000-8000-00000000000b';

function value(
  overrides: Partial<AssessmentValueInput> = {},
): AssessmentValueInput {
  return {
    metricDefinitionId: METRIC_A,
    numericValue: 3,
    textValue: null,
    note: null,
    confidence: null,
    observationCount: null,
    ...overrides,
  };
}

function bound(
  overrides: Partial<TemplateMetricBound> = {},
): TemplateMetricBound {
  return {
    metricDefinitionId: METRIC_A,
    required: true,
    minimumValue: 0,
    maximumValue: 5,
    ...overrides,
  };
}

describe('isMeasured', () => {
  it('is true when a numeric or text value is present, false otherwise', () => {
    expect(isMeasured(value({ numericValue: 0, textValue: null }))).toBe(true);
    expect(isMeasured(value({ numericValue: null, textValue: 'ok' }))).toBe(
      true,
    );
    expect(isMeasured(value({ numericValue: null, textValue: null }))).toBe(
      false,
    );
  });
});

describe('assertValuesAgainstTemplate', () => {
  it('accepts in-bounds and null (not evaluated) values', () => {
    expect(() =>
      assertValuesAgainstTemplate(
        [
          value({ numericValue: 5 }),
          value({ metricDefinitionId: METRIC_B, numericValue: null }),
        ],
        [bound(), bound({ metricDefinitionId: METRIC_B, required: false })],
      ),
    ).not.toThrow();
  });

  it('accepts values when the scale has open bounds', () => {
    expect(() =>
      assertValuesAgainstTemplate(
        [value({ numericValue: 9999 })],
        [bound({ minimumValue: null, maximumValue: null })],
      ),
    ).not.toThrow();
  });

  it('rejects a value that references an unknown metric', () => {
    expect(() =>
      assertValuesAgainstTemplate(
        [value({ metricDefinitionId: METRIC_B })],
        [bound()],
      ),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a duplicated metric value', () => {
    expect(() =>
      assertValuesAgainstTemplate([value(), value()], [bound()]),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a value below the minimum', () => {
    expect(() =>
      assertValuesAgainstTemplate([value({ numericValue: -1 })], [bound()]),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a value above the maximum', () => {
    expect(() =>
      assertValuesAgainstTemplate([value({ numericValue: 6 })], [bound()]),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects a non-finite numeric value', () => {
    expect(() =>
      assertValuesAgainstTemplate(
        [value({ numericValue: Number.POSITIVE_INFINITY })],
        [bound()],
      ),
    ).toThrow(AssessmentValidationError);
  });
});

describe('assertComplete', () => {
  it('passes when every required metric carries a measured value', () => {
    expect(() =>
      assertComplete(
        [value({ numericValue: 4 })],
        [bound(), bound({ metricDefinitionId: METRIC_B, required: false })],
      ),
    ).not.toThrow();
  });

  it('treats a null required value as missing (null-not-zero)', () => {
    expect(() =>
      assertComplete([value({ numericValue: null })], [bound()]),
    ).toThrow(AssessmentIncompleteError);
  });

  it('throws when a required metric has no value at all', () => {
    expect(() => assertComplete([], [bound()])).toThrow(
      AssessmentIncompleteError,
    );
  });
});

describe('assertReviewerIndependence', () => {
  it('forbids the evaluator reviewing their own assessment', () => {
    expect(() => assertReviewerIndependence('user-1', 'user-1')).toThrow(
      AssessmentSelfApprovalError,
    );
  });

  it('allows an independent reviewer', () => {
    expect(() =>
      assertReviewerIndependence('reviewer', 'evaluator'),
    ).not.toThrow();
  });
});
