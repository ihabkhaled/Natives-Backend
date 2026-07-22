import { ValidationError } from '@core/errors/validation.error';

import {
  REPORT_VALIDATION_MESSAGE,
  REPORT_VALIDATION_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportValidationError extends ValidationError {
  constructor() {
    super(REPORT_VALIDATION_MESSAGE, REPORT_VALIDATION_MESSAGE_KEY);
  }
}
