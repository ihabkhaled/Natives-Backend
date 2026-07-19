import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { MeasurementInvalidTransitionError } from './measurement-invalid-transition.error';
import { MeasurementProtocolDuplicateError } from './measurement-protocol-duplicate.error';
import { MeasurementProtocolNotFoundError } from './measurement-protocol-not-found.error';
import { MeasurementScopeNotFoundError } from './measurement-scope-not-found.error';
import { MeasurementSessionNotFoundError } from './measurement-session-not-found.error';
import { MeasurementValidationError } from './measurement-validation.error';
import { MeasurementVersionConflictError } from './measurement-version-conflict.error';
import { UnitIncompatibleError } from './unit-incompatible.error';

describe('measurement errors', () => {
  it('carries the right status and messageKey for each error', () => {
    const cases = [
      [
        new MeasurementScopeNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.measurements.scopeNotFound',
      ],
      [
        new MeasurementProtocolNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.measurements.protocolNotFound',
      ],
      [
        new MeasurementSessionNotFoundError(),
        HttpStatus.NOT_FOUND,
        'errors.measurements.sessionNotFound',
      ],
      [
        new MeasurementProtocolDuplicateError(),
        HttpStatus.CONFLICT,
        'errors.measurements.protocolDuplicate',
      ],
      [
        new MeasurementInvalidTransitionError(),
        HttpStatus.CONFLICT,
        'errors.measurements.invalidTransition',
      ],
      [
        new MeasurementVersionConflictError(),
        HttpStatus.CONFLICT,
        'errors.measurements.versionConflict',
      ],
      [
        new MeasurementValidationError(),
        HttpStatus.BAD_REQUEST,
        'errors.measurements.validation',
      ],
      [
        new UnitIncompatibleError(),
        HttpStatus.BAD_REQUEST,
        'errors.measurements.unitIncompatible',
      ],
    ] as const;
    for (const [error, status, messageKey] of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(messageKey);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
