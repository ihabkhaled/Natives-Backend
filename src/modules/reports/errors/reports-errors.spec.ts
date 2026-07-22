import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ReportExpiredError } from './report-expired.error';
import { ReportJobNotFoundError } from './report-job-not-found.error';
import { ReportNotReadyError } from './report-not-ready.error';
import { ReportRetryNotAllowedError } from './report-retry-not-allowed.error';
import { ReportScopeNotFoundError } from './report-scope-not-found.error';
import { ReportValidationError } from './report-validation.error';
import { ReportVersionConflictError } from './report-version-conflict.error';

describe('reports errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new ReportJobNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.reports.jobNotFound',
      },
      {
        error: new ReportScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.reports.scopeNotFound',
      },
      {
        error: new ReportValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.reports.validation',
      },
      {
        error: new ReportNotReadyError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.reports.notReady',
      },
      {
        error: new ReportExpiredError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.reports.expired',
      },
      {
        error: new ReportRetryNotAllowedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.reports.retryNotAllowed',
      },
      {
        error: new ReportVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.reports.versionConflict',
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
      new ReportJobNotFoundError().message,
      new ReportExpiredError().message,
      new ReportNotReadyError().message,
    ]) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
