import { ValidationError } from '@core/errors/validation.error';

import {
  TRYOUT_VALIDATION_MESSAGE,
  TRYOUT_VALIDATION_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutValidationError extends ValidationError {
  constructor() {
    super(TRYOUT_VALIDATION_MESSAGE, TRYOUT_VALIDATION_MESSAGE_KEY);
  }
}
