import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CoachFeedbackNotFoundError } from './coach-feedback-not-found.error';
import { DevelopmentGoalNotFoundError } from './development-goal-not-found.error';
import { DevelopmentScopeNotFoundError } from './development-scope-not-found.error';
import { DevelopmentValidationError } from './development-validation.error';
import { FeedbackAlreadyAcknowledgedError } from './feedback-already-acknowledged.error';
import { FeedbackInvalidTransitionError } from './feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from './feedback-version-conflict.error';
import { GoalInvalidTransitionError } from './goal-invalid-transition.error';
import { GoalVersionConflictError } from './goal-version-conflict.error';

describe('development errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new CoachFeedbackNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.development.feedbackNotFound',
      },
      {
        error: new DevelopmentGoalNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.development.goalNotFound',
      },
      {
        error: new DevelopmentScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.development.scopeNotFound',
      },
      {
        error: new DevelopmentValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.development.validation',
      },
      {
        error: new FeedbackAlreadyAcknowledgedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.development.feedbackAlreadyAcknowledged',
      },
      {
        error: new FeedbackInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.development.feedbackInvalidTransition',
      },
      {
        error: new FeedbackVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.development.feedbackVersionConflict',
      },
      {
        error: new GoalInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.development.goalInvalidTransition',
      },
      {
        error: new GoalVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.development.goalVersionConflict',
      },
    ];
    for (const testCase of cases) {
      expect(testCase.error.status).toBe(testCase.status);
      expect(testCase.error.messageKey).toBe(testCase.key);
      expect(testCase.error.message.length).toBeGreaterThan(0);
    }
  });
});
