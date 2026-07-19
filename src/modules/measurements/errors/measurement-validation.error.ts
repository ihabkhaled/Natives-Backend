import { ValidationError } from '@core/errors/validation.error';

import {
  MEASUREMENT_VALIDATION_MESSAGE,
  MEASUREMENT_VALIDATION_MESSAGE_KEY,
} from '../model/measurements.constants';

export class MeasurementValidationError extends ValidationError {
  constructor() {
    super(MEASUREMENT_VALIDATION_MESSAGE, MEASUREMENT_VALIDATION_MESSAGE_KEY);
  }
}
