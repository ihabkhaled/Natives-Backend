import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AnomalyInvalidTransitionError } from './anomaly-invalid-transition.error';
import { AnomalyNotFoundError } from './anomaly-not-found.error';
import { DataQualityScopeNotFoundError } from './data-quality-scope-not-found.error';
import { DataQualityValidationError } from './data-quality-validation.error';
import { DataQualityVersionConflictError } from './data-quality-version-conflict.error';
import { RepairNotAllowedError } from './repair-not-allowed.error';

describe('data-quality errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new AnomalyNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.dataQuality.anomalyNotFound',
      },
      {
        error: new DataQualityScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.dataQuality.scopeNotFound',
      },
      {
        error: new DataQualityValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.dataQuality.validation',
      },
      {
        error: new AnomalyInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.dataQuality.invalidTransition',
      },
      {
        error: new RepairNotAllowedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.dataQuality.repairNotAllowed',
      },
      {
        error: new DataQualityVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.dataQuality.versionConflict',
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
      new AnomalyNotFoundError().message,
      new RepairNotAllowedError().message,
    ]) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
