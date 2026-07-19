import { ValidationError } from '@core/errors/validation.error';

import {
  DEVELOPMENT_VALIDATION_MESSAGE,
  DEVELOPMENT_VALIDATION_MESSAGE_KEY,
} from '../model/development.constants';

export class DevelopmentValidationError extends ValidationError {
  constructor() {
    super(DEVELOPMENT_VALIDATION_MESSAGE, DEVELOPMENT_VALIDATION_MESSAGE_KEY);
  }
}
