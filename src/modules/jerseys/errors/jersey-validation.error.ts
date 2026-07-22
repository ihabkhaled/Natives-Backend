import { ValidationError } from '@core/errors/validation.error';

import {
  JERSEY_VALIDATION_MESSAGE,
  JERSEY_VALIDATION_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class JerseyValidationError extends ValidationError {
  constructor() {
    super(JERSEY_VALIDATION_MESSAGE, JERSEY_VALIDATION_MESSAGE_KEY);
  }
}
