import { ValidationError } from '@core/errors/validation.error';

import {
  ANALYSIS_VALIDATION_MESSAGE,
  ANALYSIS_VALIDATION_MESSAGE_KEY,
} from '../model/analysis.constants';

export class AnalysisValidationError extends ValidationError {
  constructor() {
    super(ANALYSIS_VALIDATION_MESSAGE, ANALYSIS_VALIDATION_MESSAGE_KEY);
  }
}
