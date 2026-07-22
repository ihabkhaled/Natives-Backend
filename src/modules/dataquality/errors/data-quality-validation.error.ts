import { ValidationError } from '@core/errors/validation.error';

import {
  DATA_QUALITY_VALIDATION_MESSAGE,
  DATA_QUALITY_VALIDATION_MESSAGE_KEY,
} from '../model/dataquality.constants';

export class DataQualityValidationError extends ValidationError {
  constructor() {
    super(DATA_QUALITY_VALIDATION_MESSAGE, DATA_QUALITY_VALIDATION_MESSAGE_KEY);
  }
}
