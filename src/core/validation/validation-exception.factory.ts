import {
  VALIDATION_FAILED_MESSAGE,
  VALIDATION_FAILED_MESSAGE_KEY,
} from '@core/errors/error.constants';
import { ValidationError } from '@core/errors/validation.error';
import type { AppLoggerPort } from '@core/logger';
import type { ValidationError as ClassValidatorError } from 'class-validator';

import { VALIDATION_LOG_MESSAGE } from './validation.constants';
import type { ValidationIssue } from './validation.types';

function flatten(error: ClassValidatorError, path: string): ValidationIssue[] {
  const own = Object.values(error.constraints ?? {}).map(constraint => ({
    field: path,
    constraint,
  }));
  const nested = (error.children ?? []).flatMap(child =>
    flatten(child, `${path}.${child.property}`),
  );
  return [...own, ...nested];
}

/**
 * Builds the global ValidationPipe `exceptionFactory`. It flattens the vendor's
 * validation errors into field/constraint issues, logs them (so every rejected
 * DTO is visible in the logs), and throws a typed `ValidationError` the
 * exception filter turns into a sanitized 400. See rules/05 and rules/18.
 */
export function createValidationExceptionFactory(
  logger: AppLoggerPort,
): (errors: ClassValidatorError[]) => ValidationError {
  return (errors: ClassValidatorError[]): ValidationError => {
    const issues = errors.flatMap(error => flatten(error, error.property));
    logger.warn(VALIDATION_LOG_MESSAGE, { issues });
    return new ValidationError(
      VALIDATION_FAILED_MESSAGE,
      VALIDATION_FAILED_MESSAGE_KEY,
    );
  };
}
