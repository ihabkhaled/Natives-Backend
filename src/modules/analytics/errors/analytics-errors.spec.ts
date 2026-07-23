import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AnalyticsForbiddenError } from './analytics-forbidden.error';
import { AnalyticsScopeNotFoundError } from './analytics-scope-not-found.error';
import { AnalyticsValidationError } from './analytics-validation.error';
import { CohortTooSmallError } from './cohort-too-small.error';

describe('analytics errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new AnalyticsScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.analytics.scopeNotFound',
      },
      {
        error: new AnalyticsValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.analytics.validation',
      },
      {
        error: new CohortTooSmallError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.analytics.cohortTooSmall',
      },
      {
        error: new AnalyticsForbiddenError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.analytics.forbidden',
      },
    ];
    for (const { error, status, key } of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('never leaks SQL, vendor text, or personal data in a message', () => {
    for (const message of [
      new AnalyticsScopeNotFoundError().message,
      new CohortTooSmallError().message,
    ]) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
