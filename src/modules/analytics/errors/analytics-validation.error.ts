import { ValidationError } from '@core/errors/validation.error';

import {
  ANALYTICS_VALIDATION_MESSAGE,
  ANALYTICS_VALIDATION_MESSAGE_KEY,
} from '../model/analytics.constants';

export class AnalyticsValidationError extends ValidationError {
  constructor() {
    super(ANALYTICS_VALIDATION_MESSAGE, ANALYTICS_VALIDATION_MESSAGE_KEY);
  }
}
