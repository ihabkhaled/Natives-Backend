import { ValidationError } from '@core/errors/validation.error';

import {
  ACTIVITY_VALIDATION_MESSAGE,
  ACTIVITY_VALIDATION_MESSAGE_KEY,
} from '../model/activities.constants';

export class ActivityValidationError extends ValidationError {
  constructor() {
    super(ACTIVITY_VALIDATION_MESSAGE, ACTIVITY_VALIDATION_MESSAGE_KEY);
  }
}
