import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ActivityBuddyConflictError } from './activity-buddy-conflict.error';
import { ActivityBuddyNotFoundError } from './activity-buddy-not-found.error';
import { ActivityDuplicateSubmissionError } from './activity-duplicate-submission.error';
import { ActivityInvalidTransitionError } from './activity-invalid-transition.error';
import { ActivityReviewForbiddenError } from './activity-review-forbidden.error';
import { ActivityReviewNoteRequiredError } from './activity-review-note-required.error';
import { ActivityScopeNotFoundError } from './activity-scope-not-found.error';
import { ActivitySubmissionNotFoundError } from './activity-submission-not-found.error';
import { ActivityTypeNotFoundError } from './activity-type-not-found.error';
import { ActivityValidationError } from './activity-validation.error';
import { ActivityVersionConflictError } from './activity-version-conflict.error';

describe('activities errors', () => {
  it('maps each error to the right status and message key', () => {
    const cases = [
      [
        new ActivitySubmissionNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.activities.submissionNotFound',
      ],
      [
        new ActivityTypeNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.activities.typeNotFound',
      ],
      [
        new ActivityScopeNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.activities.scopeNotFound',
      ],
      [
        new ActivityBuddyNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.activities.buddyNotFound',
      ],
      [
        new ActivityInvalidTransitionError(),
        HttpStatus.CONFLICT,
        'errors.activities.invalidTransition',
      ],
      [
        new ActivityVersionConflictError(),
        HttpStatus.CONFLICT,
        'errors.activities.versionConflict',
      ],
      [
        new ActivityDuplicateSubmissionError(),
        HttpStatus.CONFLICT,
        'errors.activities.duplicateSubmission',
      ],
      [
        new ActivityBuddyConflictError(),
        HttpStatus.CONFLICT,
        'errors.activities.buddyAlreadyResolved',
      ],
      [
        new ActivityValidationError(),
        HttpStatus.BAD_REQUEST,
        'errors.activities.validation',
      ],
      [
        new ActivityReviewForbiddenError(),
        HttpStatus.FORBIDDEN,
        'errors.activities.reviewForbidden',
      ],
      [
        new ActivityReviewNoteRequiredError(),
        HttpStatus.BAD_REQUEST,
        'errors.activities.reviewNoteRequired',
      ],
    ] as const;
    for (const [error, status, key] of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
