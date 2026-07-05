import { ValidationError } from '@core/errors/validation.error';
import type { ValidationError as ClassValidatorError } from 'class-validator';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { createValidationExceptionFactory } from './validation-exception.factory';

describe('createValidationExceptionFactory', () => {
  const logger = { warn: vi.fn() } as unknown as PinoLogger;
  const factory = createValidationExceptionFactory(logger);

  it('flattens constraints (including nested children), logs, and throws ValidationError', () => {
    const errors = [
      {
        property: 'title',
        constraints: { isString: 'title must be a string' },
      },
      {
        property: 'meta',
        children: [{ property: 'slug', constraints: { matches: 'invalid' } }],
      },
    ] as unknown as ClassValidatorError[];

    const result = factory(errors);

    expect(result).toBeInstanceOf(ValidationError);
    expect(result.messageKey).toBe('errors.validation.failed');
    expect(logger.warn).toHaveBeenCalledWith(
      {
        issues: [
          { field: 'title', constraint: 'title must be a string' },
          { field: 'meta.slug', constraint: 'invalid' },
        ],
      },
      'Request DTO validation failed',
    );
  });
});
