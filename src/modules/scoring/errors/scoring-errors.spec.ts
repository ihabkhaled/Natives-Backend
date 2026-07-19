import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CalculationRuleInvalidTransitionError } from './calculation-rule-invalid-transition.error';
import { CalculationRuleNotEditableError } from './calculation-rule-not-editable.error';
import { CalculationRuleNotFoundError } from './calculation-rule-not-found.error';
import { CalculationRuleVersionConflictError } from './calculation-rule-version-conflict.error';
import { ScoreProjectionNotFoundError } from './score-projection-not-found.error';
import { ScoringScopeNotFoundError } from './scoring-scope-not-found.error';
import { ScoringValidationError } from './scoring-validation.error';

describe('scoring errors', () => {
  it('carry the right status and stable message key', () => {
    const cases = [
      [new CalculationRuleNotFoundError(), HttpStatus.NOT_FOUND, 'errors.scoring.ruleNotFound'],
      [
        new CalculationRuleInvalidTransitionError(),
        HttpStatus.CONFLICT,
        'errors.scoring.ruleInvalidTransition',
      ],
      [
        new CalculationRuleVersionConflictError(),
        HttpStatus.CONFLICT,
        'errors.scoring.ruleVersionConflict',
      ],
      [
        new CalculationRuleNotEditableError(),
        HttpStatus.CONFLICT,
        'errors.scoring.ruleNotEditable',
      ],
      [new ScoringValidationError(), HttpStatus.BAD_REQUEST, 'errors.scoring.validation'],
      [
        new ScoringScopeNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.scoring.scopeNotFound',
      ],
      [
        new ScoreProjectionNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.scoring.projectionNotFound',
      ],
    ] as const;
    for (const [error, status, key] of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
