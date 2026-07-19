import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { PointsAdjustmentConflictError } from './points-adjustment-conflict.error';
import { PointsRuleInvalidTransitionError } from './points-rule-invalid-transition.error';
import { PointsRuleNotFoundError } from './points-rule-not-found.error';
import { PointsRuleVersionConflictError } from './points-rule-version-conflict.error';
import { PointsScopeNotFoundError } from './points-scope-not-found.error';
import { PointsValidationError } from './points-validation.error';

describe('points errors', () => {
  it('carry the right status and stable message key', () => {
    const cases = [
      [
        new PointsRuleNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.points.ruleNotFound',
      ],
      [
        new PointsRuleInvalidTransitionError(),
        HttpStatus.CONFLICT,
        'errors.points.ruleInvalidTransition',
      ],
      [
        new PointsRuleVersionConflictError(),
        HttpStatus.CONFLICT,
        'errors.points.ruleVersionConflict',
      ],
      [
        new PointsValidationError(),
        HttpStatus.BAD_REQUEST,
        'errors.points.validation',
      ],
      [
        new PointsScopeNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.points.scopeNotFound',
      ],
      [
        new PointsAdjustmentConflictError(),
        HttpStatus.CONFLICT,
        'errors.points.adjustmentConflict',
      ],
    ] as const;
    for (const [error, status, key] of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
