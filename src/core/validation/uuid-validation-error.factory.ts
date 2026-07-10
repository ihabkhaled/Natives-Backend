import { ValidationError } from '@core/errors/validation.error';

import {
  UUID_INVALID_MESSAGE,
  UUID_INVALID_MESSAGE_KEY,
} from './validation.constants';

export function createUuidValidationError(): ValidationError {
  return new ValidationError(UUID_INVALID_MESSAGE, UUID_INVALID_MESSAGE_KEY);
}
