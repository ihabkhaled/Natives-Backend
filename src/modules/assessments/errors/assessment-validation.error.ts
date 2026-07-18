import { ValidationError } from '@core/errors/validation.error';

import {
  ASSESSMENT_VALIDATION_MESSAGE,
  ASSESSMENT_VALIDATION_MESSAGE_KEY,
} from '../model/assessments.constants';

export class AssessmentValidationError extends ValidationError {
  constructor() {
    super(ASSESSMENT_VALIDATION_MESSAGE, ASSESSMENT_VALIDATION_MESSAGE_KEY);
  }
}
